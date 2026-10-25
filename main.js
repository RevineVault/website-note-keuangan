/* ==========================================================================
   FINANCEVAULT - CORE ENGINE & DATABASE (TAHAP 2)
   File: main.js
   Deskripsi: Mesin utama (Singleton). Mengatur localStorage, Multi-Tenancy 
              (Buku Pribadi & Bisnis), keamanan Double-Entry, dan Event Bus.
              TIDAK ADA logika UI atau Kalkulator di file ini.
   ========================================================================== */

(function() {
    'use strict';

    // 1. INISIALISASI NAMESPACE GLOBAL
    // Memastikan modul lain bisa mendaftarkan diri mereka tanpa saling tabrak.
    window.FinanceVault = window.FinanceVault || {
        Core: {},
        UI: {},
        Calc: {},
        Calendar: {},
        Wallets: {},
        Transactions: {},
        Stats: {},
        Settings: {}
    };

    // 2. EVENT BUS (Sistem Komunikasi Antar File)
    // Modul A bisa 'emit' (teriak), Modul B bisa 'on' (mendengar) tanpa saling panggil langsung.
    const EventBus = {
        listeners: {},
        on: function(event, callback) {
            if (!this.listeners[event]) this.listeners[event] = [];
            this.listeners[event].push(callback);
        },
        emit: function(event, data) {
            if (this.listeners[event]) {
                this.listeners[event].forEach(callback => callback(data));
            }
        }
    };
    window.FinanceVault.EventBus = EventBus;

    // 3. STORAGE ENGINE (Mesin Database Lokal)
    const DB_KEY = 'FinanceVault_DB';
    
    // Data Default jika aplikasi baru pertama kali dibuka
    const DEFAULT_DATA = {
        activeBookId: 'book_private',
        books: {
            'book_private': {
                id: 'book_private',
                name: 'Buku Pribadi',
                type: 'personal',
                wallets: [
                    { id: 'w_cash_priv', name: 'Uang Tunai', balance: 0, icon: '💵', color: '#10b981' },
                    { id: 'w_bank_priv', name: 'Bank Jago', balance: 0, icon: '🏦', color: '#f59e0b' }
                ],
                categories: {
                    income: ['Gaji/Uang Jajan', 'Pemberian', 'Lainnya'],
                    expense: ['Makan & Minum', 'Transportasi', 'Kuota/Internet', 'Hiburan', 'Lainnya']
                },
                transactions: []
            },
            'book_revine': {
                id: 'book_revine',
                name: 'Kas Revine Vault',
                type: 'business',
                wallets: [
                    { id: 'w_cash_rev', name: 'Saldo Dana/Gopay', balance: 0, icon: '📱', color: '#3b82f6' },
                    { id: 'w_bank_rev', name: 'Rekening Usaha', balance: 0, icon: '🏢', color: '#8b5cf6' }
                ],
                categories: {
                    income: ['Penjualan Item', 'Suntikan Modal', 'Lainnya'],
                    expense: ['Server Hosting', 'Domain', 'Operasional', 'Lainnya']
                },
                transactions: []
            }
        }
    };

    let dbState = null;

    window.FinanceVault.Core = {
        // --- A. INISIALISASI & MANAJEMEN DATABASE ---
        init: function() {
            console.log("[Core] Menyalakan Mesin Database...");
            this.loadDB();
            
            // Memberi tahu modul lain bahwa Core sudah siap
            EventBus.emit('core:ready', this.getActiveBook());
        },

        loadDB: function() {
            try {
                const raw = localStorage.getItem(DB_KEY);
                if (raw) {
                    dbState = JSON.parse(raw);
                    // Pengecekan integritas (jika versi lama, dll)
                    if (!dbState.books) throw new Error("Struktur database korup.");
                } else {
                    console.warn("[Core] Database kosong, membuat struktur baru...");
                    dbState = JSON.parse(JSON.stringify(DEFAULT_DATA)); // Deep copy
                    this.saveDB();
                }
            } catch (e) {
                console.error("[Core] Gagal memuat database:", e);
                alert("Kesalahan fatal saat memuat data. Mengembalikan ke pengaturan awal.");
                dbState = JSON.parse(JSON.stringify(DEFAULT_DATA));
                this.saveDB();
            }
        },

        saveDB: function() {
            try {
                localStorage.setItem(DB_KEY, JSON.stringify(dbState));
                EventBus.emit('db:updated', this.getActiveBook());
            } catch (e) {
                console.error("[Core] Gagal menyimpan ke localStorage:", e);
                alert("Penyimpanan penuh atau diblokir oleh browser!");
            }
        },

        // --- B. MULTI-TENANCY (Manajemen Buku) ---
        getActiveBook: function() {
            return dbState.books[dbState.activeBookId];
        },

        switchBook: function(bookId) {
            if (dbState.books[bookId]) {
                dbState.activeBookId = bookId;
                this.saveDB();
                console.log(`[Core] Pindah ke ruang kerja: ${dbState.books[bookId].name}`);
                EventBus.emit('book:switched', this.getActiveBook());
            }
        },

        getAllBooks: function() {
            return Object.values(dbState.books);
        },

        // --- C. LOGIKA TRANSAKSI & DOUBLE-ENTRY ---
        addTransaction: function(txData) {
            /* 
               Struktur txData:
               { type: 'income'|'expense'|'transfer', amount: number, date: ISOString,
                 walletId: string (atau source/dest wallet untuk transfer), 
                 categoryId: string, note: string }
            */
            const book = this.getActiveBook();
            
            // 1. Buat ID unik berdasarkan timestamp
            const newTx = {
                id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                timestamp: Date.now(),
                ...txData
            };

            // 2. Double-Entry Validation (Ubah Saldo Dompet)
            if (txData.type === 'income') {
                this._modifyWalletBalance(book.id, txData.walletId, txData.amount);
            } else if (txData.type === 'expense') {
                // Pastikan saldo tidak minus atau setidaknya tercatat pengurangannya
                this._modifyWalletBalance(book.id, txData.walletId, -Math.abs(txData.amount));
            } else if (txData.type === 'transfer') {
                this._modifyWalletBalance(book.id, txData.sourceWalletId, -Math.abs(txData.amount));
                this._modifyWalletBalance(book.id, txData.destWalletId, Math.abs(txData.amount));
            }

            // 3. Simpan ke riwayat buku
            book.transactions.push(newTx);
            
            // Sortir dari yang terbaru
            book.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

            this.saveDB();
            EventBus.emit('transaction:added', newTx);
            return newTx;
        },

        deleteTransaction: function(txId) {
            const book = this.getActiveBook();
            const txIndex = book.transactions.findIndex(t => t.id === txId);
            
            if (txIndex === -1) return false;
            
            const tx = book.transactions[txIndex];

            // ROLLBACK SALDO DOMPET (Double-Entry Reversal)
            if (tx.type === 'income') {
                this._modifyWalletBalance(book.id, tx.walletId, -Math.abs(tx.amount));
            } else if (tx.type === 'expense') {
                this._modifyWalletBalance(book.id, tx.walletId, Math.abs(tx.amount));
            } else if (tx.type === 'transfer') {
                this._modifyWalletBalance(book.id, tx.sourceWalletId, Math.abs(tx.amount));
                this._modifyWalletBalance(book.id, tx.destWalletId, -Math.abs(tx.amount));
            }

            // Hapus dari array
            book.transactions.splice(txIndex, 1);
            this.saveDB();
            
            EventBus.emit('transaction:deleted', txId);
            return true;
        },

        // --- D. MANAJEMEN DOMPET (Internal Core) ---
        _modifyWalletBalance: function(bookId, walletId, amountModifier) {
            const wallet = dbState.books[bookId].wallets.find(w => w.id === walletId);
            if (wallet) {
                wallet.balance += amountModifier;
            } else {
                console.error("[Core] Dompet tidak ditemukan untuk transaksi ini!");
            }
        },

        getWallets: function() {
            return this.getActiveBook().wallets;
        },

        // Fungsi Utilitas untuk kalkulasi total di dashboard
        getFinancialSummary: function(month, year) {
            const book = this.getActiveBook();
            let totalIncome = 0;
            let totalExpense = 0;
            
            const filteredTx = book.transactions.filter(tx => {
                const d = new Date(tx.date);
                return d.getMonth() === month && d.getFullYear() === year;
            });

            filteredTx.forEach(tx => {
                if (tx.type === 'income') totalIncome += tx.amount;
                if (tx.type === 'expense') totalExpense += tx.amount;
            });

            const totalBalance = book.wallets.reduce((acc, curr) => acc + curr.balance, 0);

            return { totalIncome, totalExpense, totalBalance, transactionCount: filteredTx.length };
        }
    };

    // Bootstrapper: Dijalankan ketika seluruh DOM siap
document.addEventListener('DOMContentLoaded', () => {
    // FIX BUG: Kasih delay 50ms biar semua modul lain selesai masang EventBus.on
    // sebelum Core Engine teriak ngasih sinyal 'core:ready'
    setTimeout(() => {
        window.FinanceVault.Core.init();
    }, 50);
});

})();

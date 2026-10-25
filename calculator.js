/* ==========================================================================
   FINANCEVAULT - CALCULATOR & TRANSACTION INPUT (TAHAP 4)
   File: calculator.js
   Deskripsi: Mesin penghitung untuk Numpad. Membaca input, menghitung operasi
              matematika secara aman (tanpa eval), mengatur form tambah transaksi,
              dan mengirim data bersih ke Core Engine.
   ========================================================================== */

(function() {
    'use strict';

    const EventBus = window.FinanceVault.EventBus;

    window.FinanceVault.Calc = {
        state: {
            expression: '0',
            type: 'expense', // 'expense', 'income', 'transfer'
            date: '',
            walletId: '',
            destWalletId: '', // Khusus transfer
            categoryId: '',
            note: ''
        },

        init: function() {
            console.log("[Calc] Menginisialisasi Mesin Kalkulator...");
            this.cacheDOM();
            this.bindEvents();
            this.setDefaultDate();
            
            // Dengarkan jika buku berganti, reset pilihan dompet & kategori
            EventBus.on('book:switched', (book) => this.resetFormDefaults(book));
            EventBus.on('core:ready', (book) => this.resetFormDefaults(book));
        },

        cacheDOM: function() {
            this.display = document.getElementById('calc-display');
            this.container = document.getElementById('calc-display-container');
            this.label = document.getElementById('calc-display-label');
            
            this.numpadBtns = document.querySelectorAll('.numpad-btn[data-val]');
            this.btnSave = document.getElementById('btn-save-tx');
            
            this.tabExpense = document.getElementById('tab-expense');
            this.tabIncome = document.getElementById('tab-income');
            this.tabTransfer = document.getElementById('tab-transfer');
            
            this.inputDate = document.getElementById('tx-input-date');
            this.inputNote = document.getElementById('tx-input-note');
            
            this.elSelectedAccount = document.getElementById('tx-selected-account');
            this.elSelectedCategory = document.getElementById('tx-selected-category');
        },

        bindEvents: function() {
            // 1. Event Numpad
            this.numpadBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const val = e.currentTarget.getAttribute('data-val');
                    this.handleInput(val);
                    this.animateDisplay();
                });
            });

            // 2. Event Tabs (Tipe Transaksi)
            this.tabExpense.addEventListener('click', () => this.setTransactionType('expense'));
            this.tabIncome.addEventListener('click', () => this.setTransactionType('income'));
            this.tabTransfer.addEventListener('click', () => this.setTransactionType('transfer'));

            // 3. Tombol Simpan
            this.btnSave.addEventListener('click', () => this.saveTransaction());
        },

        setDefaultDate: function() {
            const now = new Date();
            // Format to YYYY-MM-DDTHH:mm
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            this.inputDate.value = now.toISOString().slice(0, 16);
            this.state.date = now.toISOString();
        },

        resetFormDefaults: function(book) {
            if (!book) return;
            // Set dompet pertama sebagai default
            if (book.wallets && book.wallets.length > 0) {
                this.state.walletId = book.wallets[0].id;
                this.elSelectedAccount.textContent = book.wallets[0].name;
            }
            // Set kategori pertama dari pengeluaran sebagai default
            if (book.categories && book.categories.expense && book.categories.expense.length > 0) {
                this.state.categoryId = 'cat_exp_0'; // Nanti ini disesuaikan dengan struktur ID asli
                this.elSelectedCategory.textContent = book.categories.expense[0];
            }
            this.state.note = '';
            this.inputNote.value = '';
            this.state.expression = '0';
            this.updateDisplay();
            this.setTransactionType('expense'); // Reset ke pengeluaran
        },

        // --- A. LOGIKA KALKULATOR (AMAN TANPA EVAL) ---
        handleInput: function(val) {
            if (val === 'backspace') {
                if (this.state.expression.length > 1) {
                    this.state.expression = this.state.expression.slice(0, -1);
                } else {
                    this.state.expression = '0';
                }
            } else if (val === 'today') {
                this.setDefaultDate();
                // Opsional: Bikin toast notification "Tanggal direset ke hari ini"
            } else if (val === '+' || val === '-') {
                const lastChar = this.state.expression.slice(-1);
                // Cegah dobel operator
                if (lastChar === '+' || lastChar === '-') {
                    this.state.expression = this.state.expression.slice(0, -1) + val;
                } else {
                    this.state.expression += val;
                }
            } else {
                // Input Angka atau '000'
                if (this.state.expression === '0' && val !== '000') {
                    this.state.expression = val;
                } else if (this.state.expression === '0' && val === '000') {
                    // Jangan biarkan jadi '0000'
                    return;
                } else {
                    this.state.expression += val;
                }
            }
            this.updateDisplay();
        },

        // Parser matematika kustom yang super aman
        evaluateMath: function(expr) {
            try {
                // Regex untuk memecah angka dan operator (+ atau -)
                const tokens = expr.split(/(?=[+-])|(?<=[+-])/).filter(Boolean);
                let total = 0;
                let currentOp = '+';

                for (let i = 0; i < tokens.length; i++) {
                    const token = tokens[i];
                    if (token === '+' || token === '-') {
                        currentOp = token;
                    } else {
                        const num = parseInt(token, 10);
                        if (!isNaN(num)) {
                            if (currentOp === '+') total += num;
                            if (currentOp === '-') total -= num;
                        }
                    }
                }
                return total;
            } catch (e) {
                console.error("Gagal parse matematika:", e);
                return 0;
            }
        },

        updateDisplay: function() {
            // Tampilkan ekspresi kotor saat diketik (ex: 10.000+5.000)
            const formatted = this.state.expression.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
            this.display.textContent = formatted;
        },

        animateDisplay: function() {
            this.display.classList.remove('pulse-text');
            void this.display.offsetWidth; // trigger reflow
            this.display.classList.add('pulse-text');
        },

        // --- B. TIPE TRANSAKSI & TEMA DINAMIS ---
        setTransactionType: function(type) {
            this.state.type = type;
            
            // Reset tab styles
            this.tabExpense.className = "flex-1 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition tx-type-tab";
            this.tabIncome.className = "flex-1 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition tx-type-tab";
            this.tabTransfer.className = "flex-1 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition tx-type-tab";
            
            // Hapus theme classes dari body form
            const formBody = document.getElementById('tx-modal').querySelector('.modal-content');
            formBody.classList.remove('theme-income', 'theme-transfer');

            if (type === 'expense') {
                this.tabExpense.classList.add('active-expense');
                this.label.textContent = "NOMINAL PENGELUARAN";
            } else if (type === 'income') {
                this.tabIncome.classList.add('active-income');
                formBody.classList.add('theme-income');
                this.label.textContent = "NOMINAL PEMASUKAN";
            } else if (type === 'transfer') {
                this.tabTransfer.classList.add('active-transfer');
                formBody.classList.add('theme-transfer');
                this.label.textContent = "NOMINAL TRANSFER";
            }
        },

        // --- C. MENYIMPAN DATA TRANSAKSI ---
        saveTransaction: function() {
            const finalAmount = this.evaluateMath(this.state.expression);
            
            if (finalAmount <= 0) {
                alert("Nominal transaksi tidak boleh kosong atau minus!");
                return;
            }

            // Siapkan data untuk Core
            const txData = {
                type: this.state.type,
                amount: finalAmount,
                date: new Date(this.inputDate.value).toISOString(),
                note: this.inputNote.value.trim() || 'Tanpa Keterangan',
                categoryId: this.state.categoryId
            };

            if (this.state.type === 'transfer') {
                txData.sourceWalletId = this.state.walletId;
                // Dummy dest wallet untuk sekarang, nanti diatur lewat UI Wallet Picker
                txData.destWalletId = 'w_bank_priv'; 
            } else {
                txData.walletId = this.state.walletId;
            }

            // Tembak data ke Core
            window.FinanceVault.Core.addTransaction(txData);

            // Bersihkan kalkulator dan tutup modal
            this.state.expression = '0';
            this.updateDisplay();
            this.inputNote.value = '';
            
            window.FinanceVault.UI.closeModal('tx-modal');
            
            // Berikan feedback getar di HP (kalau didukung)
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }
        }
    };

    // Jalankan setelah DOM siap
    document.addEventListener('DOMContentLoaded', () => {
        window.FinanceVault.Calc.init();
    });

})();

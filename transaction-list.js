/* ==========================================================================
   FINANCEVAULT - TRANSACTION LIST & HISTORY (TAHAP 7)
   File: transaction-list.js
   Deskripsi: Mengambil data transaksi dari Core, merender daftar ke Dasbor 
              (Ringkas) dan Riwayat (Lengkap). Menangani fungsi hapus (Rollback)
              dan filter tampilan Riwayat.
   ========================================================================== */

(function() {
    'use strict';

    const EventBus = window.FinanceVault.EventBus;

    window.FinanceVault.Transactions = {
        state: {
            currentFilter: 'all', // 'all', 'income', 'expense'
            searchQuery: ''
        },

        init: function() {
            console.log("[Transactions] Menginisialisasi Daftar Riwayat...");
            this.cacheDOM();
            this.bindEvents();

            // Render otomatis saat core menyala atau data berubah
            EventBus.on('core:ready', () => this.render());
            EventBus.on('db:updated', () => this.render());
            EventBus.on('book:switched', () => this.render());
            
            // Failsafe: Jika Core sudah terlanjur ready duluan sebelum script ini terinisialisasi
            if (window.FinanceVault && window.FinanceVault.Core && window.FinanceVault.Core.getActiveBook) {
                const activeBook = window.FinanceVault.Core.getActiveBook();
                if (activeBook) {
                    this.render();
                }
            }
        },

        cacheDOM: function() {
            // FIX BUG 2: ID disesuaikan persis dengan index.html
            this.dashListContainer = document.getElementById('dash-recent-transactions');
            this.historyListContainer = document.getElementById('transaction-list-container');

            this.filterContainer = document.getElementById('tx-filter-container');
            if (this.filterContainer) {
                this.filterBtns = this.filterContainer.querySelectorAll('[data-filter]');
            }
            this.searchInput = document.getElementById('tx-search-input');
        },

        bindEvents: function() {
            // 1. Event Hapus (Delegation)
            document.addEventListener('click', (e) => {
                const btnDelete = e.target.closest('.btn-delete-tx');
                if (btnDelete) {
                    const txId = btnDelete.getAttribute('data-id');
                    this.confirmDelete(txId);
                }
            });

            // 2. Event Tombol Filter
            if (this.filterBtns) {
                this.filterBtns.forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const filterType = e.target.getAttribute('data-filter');
                        this.setFilter(filterType);
                    });
                });
            }

            // 3. Event Pencarian Live
            if (this.searchInput) {
                this.searchInput.addEventListener('input', (e) => {
                    this.state.searchQuery = e.target.value.toLowerCase();
                    this.renderHistoryView();
                });
            }
        },

        setFilter: function(filterType) {
            this.state.currentFilter = filterType;
            
            // Update Gaya UI Tombol
            if (this.filterBtns) {
                this.filterBtns.forEach(btn => {
                    if (btn.getAttribute('data-filter') === filterType) {
                        btn.className = "px-5 py-2 bg-slate-800 text-white rounded-full text-sm font-semibold shadow-md whitespace-nowrap transition transform active:scale-95";
                    } else {
                        btn.className = "px-5 py-2 bg-slate-50 border border-slate-200 text-slate-600 rounded-full text-sm font-semibold hover:bg-slate-100 whitespace-nowrap transition transform active:scale-95";
                    }
                });
            }
            this.renderHistoryView();
        },

        formatCurrency: function(amount) {
            return 'Rp ' + amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        },

        formatDate: function(isoString) {
            const date = new Date(isoString);
            return date.toLocaleDateString('id-ID', { 
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        },

        confirmDelete: function(txId) {
            const isSure = confirm("Hapus transaksi ini? Saldo pada dompet terkait akan otomatis dikembalikan (Rollback).");
            if (isSure) {
                window.FinanceVault.Core.deleteTransaction(txId);
                if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
            }
        },

        render: function() {
            this.renderDashboardView();
            this.renderHistoryView();
        },

        generateTxHTML: function(tx, book) {
            let iconSvg = '';
            let colorClass = '';
            let bgClass = '';
            let operator = '';
            
            const wallet = book.wallets.find(w => w.id === tx.walletId) || { name: 'Dompet Dihapus' };

            if (tx.type === 'income') {
                iconSvg = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path></svg>`;
                colorClass = 'text-emerald-600';
                bgClass = 'bg-emerald-50';
                operator = '+ ';
            } else if (tx.type === 'expense') {
                iconSvg = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path></svg>`;
                colorClass = 'text-rose-600';
                bgClass = 'bg-rose-50';
                operator = '- ';
            } else if (tx.type === 'transfer') {
                iconSvg = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>`;
                colorClass = 'text-blue-600';
                bgClass = 'bg-blue-50';
                operator = '';
            }

            return `
                <div class="flex items-center justify-between p-3 sm:p-4 bg-white rounded-xl border border-slate-100 shadow-sm mb-3 group hover:border-slate-300 transition-all">
                    <div class="flex items-center gap-3 sm:gap-4 overflow-hidden">
                        <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 ${bgClass} ${colorClass}">
                            ${iconSvg}
                        </div>
                        <div class="flex flex-col overflow-hidden">
                            <span class="font-bold text-slate-800 text-sm sm:text-base truncate">${tx.note}</span>
                            <div class="flex items-center gap-2 text-xs text-slate-500">
                                <span class="truncate max-w-[80px] sm:max-w-none">${wallet.name}</span>
                                <span>&bull;</span>
                                <span>${this.formatDate(tx.date)}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex items-center gap-3 sm:gap-4 flex-shrink-0 pl-2">
                        <span class="font-bold ${colorClass} text-sm sm:text-base whitespace-nowrap">
                            ${operator}${this.formatCurrency(tx.amount)}
                        </span>
                        
                        <button data-id="${tx.id}" class="btn-delete-tx text-slate-300 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-colors focus:outline-none">
                            <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                </div>
            `;
        },

        renderDashboardView: function() {
            if (!this.dashListContainer) return;
            const book = window.FinanceVault.Core.getActiveBook();
            if (!book) return;

            const transactions = book.transactions || [];

            if (transactions.length === 0) {
                this.dashListContainer.innerHTML = `
                    <div class="text-center py-8 text-slate-400 flex flex-col items-center">
                        <svg class="w-12 h-12 mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
                        <p class="font-medium">Belum ada transaksi.</p>
                        <p class="text-sm">Klik tombol + di bawah untuk mulai mencatat.</p>
                    </div>
                `;
                return;
            }

            const recentTxs = transactions.slice(0, 5);
            let html = '';
            
            recentTxs.forEach(tx => {
                html += this.generateTxHTML(tx, book);
            });

            this.dashListContainer.innerHTML = html;
        },

        renderHistoryView: function() {
            if (!this.historyListContainer) return;
            const book = window.FinanceVault.Core.getActiveBook();
            if (!book) return;

            let transactions = book.transactions || [];

            // 1. Terapkan Filter Kategori
            if (this.state.currentFilter !== 'all') {
                transactions = transactions.filter(tx => tx.type === this.state.currentFilter);
            }

            // 2. Terapkan Filter Pencarian
            if (this.state.searchQuery.trim() !== '') {
                transactions = transactions.filter(tx => {
                    return tx.note.toLowerCase().includes(this.state.searchQuery);
                });
            }

            if (transactions.length === 0) {
                 this.historyListContainer.innerHTML = `
                    <div class="text-center py-12 text-slate-400 flex flex-col items-center bg-white rounded-2xl border border-slate-200">
                        <svg class="w-16 h-16 mb-4 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
                        <p class="font-bold text-slate-600 text-lg">Tidak ada catatan.</p>
                        <p class="text-sm">Belum ada transaksi di tab ini.</p>
                    </div>
                `;
                return;
            }

            let html = '';
            transactions.forEach(tx => {
                html += this.generateTxHTML(tx, book);
            });
            this.historyListContainer.innerHTML = html;
        }
    };

    // FIX BUG 1: Hapus setTimeout penunda, biarkan dia bersiap sejak awal.
    document.addEventListener('DOMContentLoaded', () => {
        window.FinanceVault.Transactions.init();
    });

})();
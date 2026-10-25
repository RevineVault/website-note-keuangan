/* ==========================================================================
   FINANCEVAULT - WALLET MANAGER (TAHAP 6)
   File: wallet-manager.js
   Deskripsi: Mengelola tampilan daftar dompet, sinkronisasi saldo di dasbor 
              dan halaman manajemen dompet. Mendukung pemisahan aset 
              berdasarkan Buku yang sedang aktif.
   ========================================================================== */

(function() {
    'use strict';

    const EventBus = window.FinanceVault.EventBus;

    window.FinanceVault.Wallets = {
        init: function() {
            console.log("[Wallets] Menginisialisasi Manajer Dompet...");
            this.cacheDOM();
            
            // Render saat core siap atau ada perubahan data/buku
            EventBus.on('core:ready', () => this.render());
            EventBus.on('db:updated', () => this.render());
            EventBus.on('book:switched', () => this.render());
        },

        cacheDOM: function() {
            // Container di halaman Dompet
            this.walletListContainer = document.getElementById('wallet-management-list');
            
            // Container mini di Dasbor Utama
            this.dashWalletContainer = document.getElementById('dash-wallet-list');
        },

        formatCurrency: function(amount) {
            return 'Rp ' + amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        },

        render: function() {
            const wallets = window.FinanceVault.Core.getWallets();
            if (!wallets) return;

            this.renderManagementView(wallets);
            this.renderDashboardView(wallets);
            this.updateTotalBalance(wallets);
        },

        renderManagementView: function(wallets) {
            if (!this.walletListContainer) return;

            let html = '';
            
            wallets.forEach(wallet => {
                // Tentukan persentase fiktif untuk UI bar (opsional, karena saldo bisa dinamis, 
                // kita asumsikan bar penuh atau gunakan rasio terhadap total aset)
                const totalAset = wallets.reduce((acc, curr) => acc + curr.balance, 0);
                let percentage = 0;
                if (totalAset > 0) {
                    percentage = Math.round((wallet.balance / totalAset) * 100);
                } else if (wallet.balance > 0 && totalAset <= 0) {
                    percentage = 100;
                }
                
                // Cegah width minus kalau saldo minus
                const barWidth = percentage >= 0 ? percentage : 0;

                html += `
                    <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col card-hover-lift transition-all relative overflow-hidden group">
                        <!-- Dekorasi background -->
                        <div class="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10 transition-transform group-hover:scale-150" style="background-color: ${wallet.color};"></div>
                        
                        <div class="flex items-start gap-4 mb-6 relative z-10">
                            <div class="w-14 h-14 rounded-xl flex items-center justify-center text-2xl shadow-sm border border-slate-100 bg-white" style="color: ${wallet.color};">
                                ${wallet.icon}
                            </div>
                            <div class="flex-1">
                                <h3 class="font-bold text-slate-800 text-lg leading-tight mb-1">${wallet.name}</h3>
                                <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Aset Aktif</p>
                            </div>
                            <button class="text-slate-400 hover:text-slate-800 p-2 rounded-lg hover:bg-slate-50 transition">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
                            </button>
                        </div>
                        
                        <div class="mt-auto relative z-10">
                            <p class="text-3xl font-black tracking-tight mb-4 text-slate-800">${this.formatCurrency(wallet.balance)}</p>
                            
                            <!-- Progress bar proporsi aset -->
                            <div class="w-full bg-slate-100 rounded-full h-1.5 mb-5 overflow-hidden">
                                <div class="h-1.5 rounded-full transition-all duration-1000" style="width: ${barWidth}%; background-color: ${wallet.color};"></div>
                            </div>

                            <div class="flex gap-2">
                                <button class="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-600 font-semibold py-2 rounded-lg text-sm transition border border-slate-200">Riwayat</button>
                                <button class="flex-1 text-white font-semibold py-2 rounded-lg text-sm transition shadow-sm hover:shadow active:scale-95" style="background-color: ${wallet.color};">Transfer</button>
                            </div>
                        </div>
                    </div>
                `;
            });

            this.walletListContainer.innerHTML = html;
        },

        renderDashboardView: function(wallets) {
            if (!this.dashWalletContainer) return;

            let html = '';
            
            wallets.forEach(wallet => {
                html += `
                    <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between card-hover-lift transition cursor-pointer">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full flex items-center justify-center bg-slate-50 text-xl border border-slate-100">
                                ${wallet.icon}
                            </div>
                            <div class="flex flex-col">
                                <span class="text-xs font-bold text-slate-500">${wallet.name}</span>
                                <span class="text-sm font-black text-slate-800">${this.formatCurrency(wallet.balance)}</span>
                            </div>
                        </div>
                    </div>
                `;
            });

            // Tambah tombol '+' jika ingin nambah dompet dari dasbor
            html += `
                <div class="bg-slate-50 hover:bg-slate-100 border-2 border-dashed border-slate-200 p-4 rounded-xl flex items-center justify-center cursor-pointer transition text-slate-400 hover:text-blue-600" onclick="FinanceVault.UI.switchView('view-wallets')">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                </div>
            `;

            this.dashWalletContainer.innerHTML = html;
        },

        updateTotalBalance: function(wallets) {
            // Update kartu total saldo di Dasbor
            const elTotalSaldo = document.getElementById('dash-total-saldo');
            if (elTotalSaldo) {
                const totalBalance = wallets.reduce((acc, curr) => acc + curr.balance, 0);
                elTotalSaldo.textContent = this.formatCurrency(totalBalance);
            }
        }
    };

    // Jalankan setelah DOM siap
    document.addEventListener('DOMContentLoaded', () => {
        window.FinanceVault.Wallets.init();
    });

})();

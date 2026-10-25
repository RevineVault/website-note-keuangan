/* ==========================================================================
   FINANCEVAULT - DASHBOARD & STATISTICS (TAHAP 8)
   File: statistics.js
   Deskripsi: Mengurus angka-angka ringkasan kas masuk/keluar di atas dasbor,
              dan merender chart donat pengeluaran.
   ========================================================================== */

(function() {
    'use strict';

    const EventBus = window.FinanceVault.EventBus;

    window.FinanceVault.Stats = {
        chartInstance: null,

        init: function() {
            console.log("[Stats] Menginisialisasi Statistik & Dashboard...");
            this.cacheDOM();

            // Render saat core siap atau ada perubahan
            EventBus.on('core:ready', () => this.render());
            EventBus.on('db:updated', () => this.render());
            EventBus.on('book:switched', () => this.render());
            
            // Render ulang chart khusus saat pindah ke halaman statistik (biar animasi jalannya pas diliat)
            EventBus.on('ui:view_changed', (viewId) => {
                if (viewId === 'view-statistics') {
                    this.renderChart();
                }
            });
        },

        cacheDOM: function() {
            this.elDashMasuk = document.getElementById('dash-total-masuk');
            this.elDashKeluar = document.getElementById('dash-total-keluar');
            this.elZBB = document.getElementById('dash-budget-left');
        },

        formatCurrency: function(amount) {
            return 'Rp ' + amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        },

        render: function() {
            const now = new Date();
            const summary = window.FinanceVault.Core.getFinancialSummary(now.getMonth(), now.getFullYear());

            if (this.elDashMasuk) {
                this.elDashMasuk.textContent = this.formatCurrency(summary.totalIncome);
            }
            if (this.elDashKeluar) {
                this.elDashKeluar.textContent = this.formatCurrency(summary.totalExpense);
            }
            if (this.elZBB) {
                // Konsep Zero Based Budgeting: Sisa duit (Pemasukan - Pengeluaran)
                const sisa = summary.totalIncome - summary.totalExpense;
                this.elZBB.textContent = this.formatCurrency(Math.max(0, sisa));
            }
            
            // Kita juga update chart kalo lagi buka halaman stats
            if (window.FinanceVault.UI.currentView === 'view-statistics') {
                this.renderChart();
            }
        },

        renderChart: function() {
            const canvas = document.getElementById('chart-pengeluaran');
            const centerText = document.getElementById('chart-center-text');
            if (!canvas || typeof Chart === 'undefined') return;

            const book = window.FinanceVault.Core.getActiveBook();
            if (!book) return;

            // Kumpulin data pengeluaran bulan ini
            const now = new Date();
            let totalExpense = 0;
            const expenseByCategory = {};

            // Inisialisasi kategori (opsional, biar kategori yang 0 tetep muncul kalo mau)
            // book.categories.expense.forEach(c => expenseByCategory[c] = 0);

            book.transactions.forEach(tx => {
                const txDate = new Date(tx.date);
                if (tx.type === 'expense' && txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear()) {
                    const cat = tx.categoryId || 'Lainnya'; // Sementara pake fallback
                    expenseByCategory[cat] = (expenseByCategory[cat] || 0) + tx.amount;
                    totalExpense += tx.amount;
                }
            });

            // Update text di tengah donat
            if (centerText) {
                const amountEl = centerText.querySelector('.text-2xl');
                if (amountEl) amountEl.textContent = this.formatCurrency(totalExpense);
            }

            const labels = Object.keys(expenseByCategory);
            const data = Object.values(expenseByCategory);

            // Kalau datanya kosong sama sekali, kasih dummy
            if (data.length === 0) {
                labels.push("Belum Ada Pengeluaran");
                data.push(1);
            }

            // Hancurkan chart lama kalau udah ada biar ga numpuk
            if (this.chartInstance) {
                this.chartInstance.destroy();
            }

            const ctx = canvas.getContext('2d');
            this.chartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: data,
                        backgroundColor: [
                            '#ef4444', // red-500
                            '#f97316', // orange-500
                            '#eab308', // yellow-500
                            '#8b5cf6', // violet-500
                            '#3b82f6', // blue-500
                            '#10b981', // emerald-500
                            '#94a3b8'  // slate-400
                        ],
                        borderWidth: 0,
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '75%', // Bikin donatnya tipis
                    plugins: {
                        legend: {
                            display: false // Kita sembunyiin legend bawaan, nanti dibikin custom pakai list HTML
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    let label = context.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    // Kalau ini dummy data pas kosong, jangan dikasih tulisan Rp
                                    if (context.label === "Belum Ada Pengeluaran") {
                                        return label + "0";
                                    }
                                    if (context.parsed !== null) {
                                        label += 'Rp ' + context.parsed.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                                    }
                                    return label;
                                }
                            }
                        }
                    },
                    animation: {
                        animateScale: true,
                        animateRotate: true
                    }
                }
            });

            this.renderCategoryList(expenseByCategory, totalExpense);
        },

        renderCategoryList: function(expenseByCategory, totalExpense) {
            const listContainer = document.getElementById('stats-category-list');
            if (!listContainer) return;

            if (totalExpense === 0) {
                listContainer.innerHTML = '<p class="text-slate-400 text-sm italic text-center py-4">Belum ada rincian alokasi bulan ini.</p>';
                return;
            }

            const colors = ['#ef4444', '#f97316', '#eab308', '#8b5cf6', '#3b82f6', '#10b981', '#94a3b8'];
            let html = '';
            let colorIndex = 0;

            // Sort berdasarkan pengeluaran terbesar
            const sortedCategories = Object.keys(expenseByCategory).sort((a, b) => expenseByCategory[b] - expenseByCategory[a]);

            sortedCategories.forEach(cat => {
                const amount = expenseByCategory[cat];
                if (amount > 0) {
                    const percentage = Math.round((amount / totalExpense) * 100);
                    const color = colors[colorIndex % colors.length];
                    
                    html += `
                        <div>
                            <div class="flex justify-between text-sm mb-2">
                                <span class="font-bold text-slate-700 flex items-center gap-2">
                                    <span class="w-3 h-3 rounded-full" style="background-color: ${color}"></span>
                                    ${cat}
                                </span>
                                <span class="font-bold text-slate-800">${this.formatCurrency(amount)} <span class="text-slate-400 ml-1">(${percentage}%)</span></span>
                            </div>
                            <div class="w-full bg-slate-100 rounded-full h-3">
                                <div class="h-3 rounded-full" style="width: ${percentage}%; background-color: ${color}"></div>
                            </div>
                        </div>
                    `;
                    colorIndex++;
                }
            });

            listContainer.innerHTML = html;
        }
    };

    // Jalankan setelah DOM siap
    document.addEventListener('DOMContentLoaded', () => {
        window.FinanceVault.Stats.init();
    });

})();

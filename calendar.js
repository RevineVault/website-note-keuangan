/* ==========================================================================
   FINANCEVAULT - CALENDAR ENGINE (TAHAP 5)
   File: calendar.js
   Deskripsi: Mesin perender waktu. Menghasilkan grid kalender dinamis, 
              menghitung agregasi harian (pemasukan & pengeluaran), 
              dan merender lencana mutasi secara presisi di tiap tanggal.
   ========================================================================== */

(function() {
    'use strict';

    const EventBus = window.FinanceVault.EventBus;

    window.FinanceVault.Calendar = {
        state: {
            currentDate: new Date(),
            month: new Date().getMonth(),
            year: new Date().getFullYear(),
            isViewActive: false
        },

        init: function() {
            console.log("[Calendar] Menginisialisasi Mesin Kalender...");
            this.cacheDOM();
            this.bindEvents();

            // Render awal saat core sudah siap
            EventBus.on('core:ready', () => this.render());
            
            // Re-render saat ada perubahan database atau ganti buku
            EventBus.on('db:updated', () => {
                if (this.state.isViewActive) this.render();
            });
            EventBus.on('book:switched', () => this.render());

            // Optimasi: Hanya render berat jika layar kalender sedang dibuka
            EventBus.on('ui:view_changed', (viewId) => {
                this.state.isViewActive = (viewId === 'view-calendar');
                if (this.state.isViewActive) {
                    this.render();
                }
            });
        },

        cacheDOM: function() {
            this.grid = document.getElementById('calendar-grid');
            this.monthDisplay = document.getElementById('current-month-display');
            this.btnPrev = document.getElementById('btn-prev-month');
            this.btnNext = document.getElementById('btn-next-month');
            
            // Footer Rekap
            this.elFooterIncome = document.getElementById('cal-footer-income');
            this.elFooterExpense = document.getElementById('cal-footer-expense');
            this.elFooterTotal = document.getElementById('cal-footer-total');
        },

        bindEvents: function() {
            this.btnPrev.addEventListener('click', () => {
                this.changeMonth(-1);
            });
            
            this.btnNext.addEventListener('click', () => {
                this.changeMonth(1);
            });

            // Klik header bulan untuk kembali ke bulan ini (Today)
            this.monthDisplay.addEventListener('click', () => {
                const now = new Date();
                this.state.month = now.getMonth();
                this.state.year = now.getFullYear();
                this.render();
            });
        },

        changeMonth: function(delta) {
            this.state.month += delta;
            if (this.state.month < 0) {
                this.state.month = 11;
                this.state.year--;
            } else if (this.state.month > 11) {
                this.state.month = 0;
                this.state.year++;
            }
            this.render();
        },

        formatCurrency: function(amount) {
            return 'Rp ' + amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        },

        // --- CORE RENDER LOGIC ---
        render: function() {
            if (!this.grid) return; // Failsafe

            const { month, year } = this.state;
            
            // 1. Update Header Teks Bulan & Tahun
            const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", 
                                "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
            this.monthDisplay.innerHTML = `${monthNames[month]} ${year}`;

            // 2. Hitung Matematika Kalender
            const firstDay = new Date(year, month, 1).getDay(); // 0 (Minggu) - 6 (Sabtu)
            const daysInMonth = new Date(year, month + 1, 0).getDate(); // 28-31
            const daysInPrevMonth = new Date(year, month, 0).getDate();

            // 3. Ambil Transaksi dari Core Engine
            const book = window.FinanceVault.Core.getActiveBook();
            if (!book) return;

            // Buat map agregasi transaksi per hari untuk bulan yang dipilih
            // Format: dailyData[tanggal] = { income: 0, expense: 0 }
            const dailyData = {};
            let totalIncome = 0;
            let totalExpense = 0;

            book.transactions.forEach(tx => {
                const txDate = new Date(tx.date);
                if (txDate.getMonth() === month && txDate.getFullYear() === year) {
                    const dateNum = txDate.getDate();
                    if (!dailyData[dateNum]) {
                        dailyData[dateNum] = { income: 0, expense: 0 };
                    }
                    
                    if (tx.type === 'income') {
                        dailyData[dateNum].income += tx.amount;
                        totalIncome += tx.amount;
                    } else if (tx.type === 'expense') {
                        dailyData[dateNum].expense += tx.amount;
                        totalExpense += tx.amount;
                    }
                    // Transfer tidak dimasukkan ke kalkulasi Pemasukan/Pengeluaran bulanan
                }
            });

            // 4. Update Footer Rekap
            this.elFooterIncome.textContent = this.formatCurrency(totalIncome);
            this.elFooterExpense.textContent = this.formatCurrency(totalExpense);
            
            const netTotal = totalIncome - totalExpense;
            this.elFooterTotal.textContent = this.formatCurrency(netTotal);
            this.elFooterTotal.className = netTotal >= 0 
                ? 'font-bold text-emerald-600 text-lg md:text-xl' 
                : 'font-bold text-rose-600 text-lg md:text-xl';

            // 5. Gambar Ulang Grid (42 Kotak agar stabil 6 baris)
            let html = '';
            let dayCount = 1;
            let nextMonthDayCount = 1;
            
            const today = new Date();
            const isCurrentMonth = (today.getMonth() === month && today.getFullYear() === year);
            const currentDay = today.getDate();

            for (let i = 0; i < 42; i++) {
                let cellClass = 'cal-day';
                let cellDate = '';
                let cellContent = '';

                // Kotak kosong dari bulan sebelumnya (Muted)
                if (i < firstDay) {
                    cellClass += ' muted';
                    cellDate = daysInPrevMonth - firstDay + i + 1;
                } 
                // Hari normal bulan ini
                else if (dayCount <= daysInMonth) {
                    cellDate = dayCount;
                    
                    // Highlight hari ini
                    if (isCurrentMonth && dayCount === currentDay) {
                        cellClass += ' today';
                    }

                    // Suntik badge kalau ada transaksi di hari ini
                    if (dailyData[dayCount]) {
                        const d = dailyData[dayCount];
                        if (d.income > 0) {
                            cellContent += `<span class="mut-badge mut-income">+ ${this.formatCurrency(d.income)}</span>`;
                        }
                        if (d.expense > 0) {
                            cellContent += `<span class="mut-badge mut-expense">- ${this.formatCurrency(d.expense)}</span>`;
                        }
                    }
                    
                    dayCount++;
                } 
                // Kotak sisa untuk bulan depannya (Muted)
                else {
                    cellClass += ' muted';
                    cellDate = nextMonthDayCount;
                    nextMonthDayCount++;
                }

                html += `
                    <div class="${cellClass}" data-date="${cellDate}">
                        <span class="cal-date-num">${cellDate}</span>
                        <div class="cal-mutations">
                            ${cellContent}
                        </div>
                    </div>
                `;
            }

            // Pasang HTML yang sudah dirakit ke DOM
            this.grid.innerHTML = html;

            // Opsional: Tambahkan klik pada hari untuk memunculkan detail harian
            // this._bindDayClicks();
        }
    };

    // Jalankan setelah DOM siap
    document.addEventListener('DOMContentLoaded', () => {
        window.FinanceVault.Calendar.init();
    });

})();

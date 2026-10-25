/* ==========================================================================
   FINANCEVAULT - UI & NAVIGATION CONTROLLER (TAHAP 3)
   File: ui-controller.js
   Deskripsi: Mengendalikan transisi halaman (SPA), navigasi sidebar/bottom, 
              serta buka-tutup pop-up (Modal) agar z-index tidak bentrok.
   ========================================================================== */

(function() {
    'use strict';

    const EventBus = window.FinanceVault.EventBus;

    window.FinanceVault.UI = {
        currentView: 'view-dashboard',

        init: function() {
            console.log("[UI] Menginisialisasi Pengendali Antarmuka...");
            this.setupNavigation();
            this.setupModals();
            this.setupEventListeners();
        },

        // --- A. SINGLE PAGE APPLICATION (SPA) ROUTING ---
        setupNavigation: function() {
            const navItems = document.querySelectorAll('.nav-item, .nav-item-mobile');
            
            navItems.forEach(item => {
                item.addEventListener('click', (e) => {
                    // Cari elemen terdekat yang punya data-target (jaga-jaga kalau nge-klik icon SVG-nya)
                    const targetBtn = e.target.closest('[data-target]');
                    if (!targetBtn) return;

                    const targetView = targetBtn.getAttribute('data-target');
                    this.switchView(targetView);
                });
            });
        },

        switchView: function(viewId) {
            if (this.currentView === viewId) return;

            // 1. Sembunyikan semua view
            const views = document.querySelectorAll('.app-view');
            views.forEach(v => {
                v.classList.remove('active-view');
                // Kasih delay dikit sebelum beneran di-hidden biar animasinya jalan
                setTimeout(() => {
                    if (!v.classList.contains('active-view')) {
                        v.style.display = 'none';
                    }
                }, 300); // 300ms sesuai durasi animasi CSS
            });

            // 2. Munculkan view yang baru
            const targetEl = document.getElementById(viewId);
            if (targetEl) {
                targetEl.style.display = 'block';
                // Trigger reflow biar animasi CSS jalan
                void targetEl.offsetWidth; 
                targetEl.classList.add('active-view');
                this.currentView = viewId;
            }

            // 3. Update status tombol navigasi (Aktif/Biru)
            this._updateNavButtonsState(viewId);

            // 4. Kasih tau modul lain kalau halaman pindah (siapa tau mau nge-render ulang)
            EventBus.emit('ui:view_changed', viewId);
        },

        _updateNavButtonsState: function(viewId) {
            // Desktop Sidebar
            document.querySelectorAll('.nav-item').forEach(btn => {
                if (btn.getAttribute('data-target') === viewId) {
                    btn.classList.add('active', 'bg-blue-50', 'text-blue-700');
                    btn.classList.remove('text-slate-600');
                } else {
                    btn.classList.remove('active', 'bg-blue-50', 'text-blue-700');
                    btn.classList.add('text-slate-600');
                }
            });

            // Mobile Bottom Nav
            document.querySelectorAll('.nav-item-mobile').forEach(btn => {
                if (btn.getAttribute('data-target') === viewId) {
                    btn.classList.add('active', 'text-blue-600');
                    btn.classList.remove('text-slate-400');
                } else {
                    btn.classList.remove('active', 'text-blue-600');
                    btn.classList.add('text-slate-400');
                }
            });
        },

        // --- B. MANAJEMEN MODAL & OVERLAY ---
        setupModals: function() {
            // Tombol untuk buka modal (via data-target-modal kalau ada di HTML, opsional)
            document.querySelectorAll('[data-target-modal]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const modalId = e.currentTarget.getAttribute('data-target-modal');
                    this.openModal(modalId);
                });
            });

            // Tombol silang untuk tutup modal
            document.querySelectorAll('[data-close]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const modalId = e.currentTarget.getAttribute('data-close');
                    this.closeModal(modalId);
                });
            });

            // Tutup modal kalau user nge-klik area gelap di luarnya
            document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
                backdrop.addEventListener('click', (e) => {
                    // Pastikan yang diklik beneran backdrop-nya, bukan konten di dalamnya
                    if (e.target === backdrop) {
                        this.closeModal(backdrop.id);
                    }
                });
            });
        },

        openModal: function(modalId) {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.classList.remove('hidden');
                // Trigger reflow
                void modal.offsetWidth;
                modal.classList.add('show');
                
                // Mencegah body di-scroll saat modal terbuka
                document.body.style.overflow = 'hidden';
            }
        },

        closeModal: function(modalId) {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.classList.remove('show');
                
                // Tunggu animasi selesai baru di-hidden
                setTimeout(() => {
                    modal.classList.add('hidden');
                    // Cek apakah ada modal lain yang masih kebuka, kalo ngga balikin overflow body
                    const openModals = document.querySelectorAll('.modal-backdrop.show');
                    if (openModals.length === 0) {
                        document.body.style.overflow = '';
                    }
                }, 300); // 300ms sesuai durasi transisi di CSS
            }
        },

        // --- C. INTEGRASI DENGAN CORE ENGINE ---
        setupEventListeners: function() {
            // Pas mesin database nyala, atau pas buku diganti, update nama buku di Header
            EventBus.on('core:ready', (activeBook) => this.updateHeaderBookName(activeBook));
            EventBus.on('book:switched', (activeBook) => this.updateHeaderBookName(activeBook));
            
            // Pasangkan tombol FAB ke modal Kalkulator
            const fab = document.getElementById('fab-add-tx');
            if(fab) {
                fab.addEventListener('click', () => {
                    this.openModal('tx-modal');
                });
            }

            // Tombol Switcher Buku di Header
            const btnSwitcher = document.getElementById('btn-open-book-switcher');
            if(btnSwitcher) {
                btnSwitcher.addEventListener('click', () => {
                    this.openModal('book-switcher-modal');
                    // Kita akan minta logic lain untuk ngerender list buku ke dalam modal ini
                    EventBus.emit('ui:book_switcher_opened', window.FinanceVault.Core.getAllBooks());
                });
            }
        },

        updateHeaderBookName: function(activeBook) {
            const headerNameEl = document.getElementById('active-book-name');
            if (headerNameEl && activeBook) {
                headerNameEl.textContent = activeBook.name;
                
                // Ganti warna indikator (Dot)
                const dot = headerNameEl.parentElement.querySelector('.bg-blue-600, .bg-purple-600');
                if (dot) {
                    if (activeBook.type === 'business') {
                        dot.classList.remove('bg-blue-600');
                        dot.classList.add('bg-purple-600');
                    } else {
                        dot.classList.remove('bg-purple-600');
                        dot.classList.add('bg-blue-600');
                    }
                }
            }
        }
    };

    // Jalankan inisialisasi setelah DOM siap
    document.addEventListener('DOMContentLoaded', () => {
        window.FinanceVault.UI.init();
    });

})();

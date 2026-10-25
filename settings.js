/* ==========================================================================
   FINANCEVAULT - SETTINGS & DATA MANAGEMENT (TAHAP 9)
   File: settings.js
   Deskripsi: Mengurus ekspor/impor data (JSON) dan interaksi tombol tambahan.
   ========================================================================== */

(function() {
    'use strict';

    window.FinanceVault.Settings = {
        init: function() {
            console.log("[Settings] Menginisialisasi Modul Pengaturan...");
            this.bindEvents();
        },

        bindEvents: function() {
            const btnExportJson = document.getElementById('btn-export-json');
            if (btnExportJson) {
                btnExportJson.addEventListener('click', () => this.exportBackup());
            }

            // Mencegah error pas tombol 'Bikin Buku Baru' diklik
            const bookContainer = document.getElementById('book-switcher-modal');
            if (bookContainer) {
                const btnNewBook = bookContainer.querySelector('button.w-full.mt-6');
                if (btnNewBook) {
                    btnNewBook.addEventListener('click', () => {
                        alert("Fitur Tambah Buku Kustom akan hadir di update selanjutnya! Saat ini gunakan Kas Pribadi & Revine.");
                    });
                }
            }
        },

        exportBackup: function() {
            const dbData = localStorage.getItem('FinanceVault_DB');
            if (!dbData) {
                alert("Tidak ada data untuk dibackup.");
                return;
            }

            const blob = new Blob([dbData], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            
            const date = new Date();
            const dateString = date.toISOString().split('T')[0];
            
            a.href = url;
            a.download = `FinanceVault_Backup_${dateString}.json`;
            document.body.appendChild(a);
            a.click();
            
            setTimeout(() => {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }, 0);
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        window.FinanceVault.Settings.init();
    });
})();
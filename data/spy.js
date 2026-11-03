/* ============================================================
   NEKO · data/spy.js
   Pasangan kata untuk Who is the Spy. Pemain sipil mendapat
   kata utama, penyusup mendapat kata decoy yang mirip.
   ============================================================ */
(function () {
  'use strict';

  const categories = [
    {
      id: 'jaringan',
      name: 'Jaringan',
      icon: 'network',
      pairs: [
        ['Router', 'Switch'],
        ['DNS', 'DHCP'],
        ['IP Address', 'MAC Address'],
        ['LAN', 'WAN'],
        ['Bandwidth', 'Throughput'],
        ['Ping', 'Traceroute'],
        ['Modem', 'Access Point'],
        ['Server', 'Client'],
        ['Gateway', 'Proxy'],
        ['Subnet Mask', 'Prefix'],
        ['VLAN', 'Subnet'],
        ['Wireshark', 'Nmap']
      ]
    },
    {
      id: 'media',
      name: 'Kabel & Hardware',
      icon: 'cable',
      pairs: [
        ['Kabel UTP', 'Kabel Fiber'],
        ['RJ45', 'RJ11'],
        ['Cat5e', 'Cat6'],
        ['Crimping', 'Punch-down'],
        ['Straight', 'Crossover'],
        ['Switch', 'Hub'],
        ['Patch Panel', 'Keystone'],
        ['PoE', 'Adaptor'],
        ['LAN Tester', 'Multimeter'],
        ['Single-mode', 'Multi-mode']
      ]
    },
    {
      id: 'keamanan',
      name: 'Keamanan',
      icon: 'shield',
      pairs: [
        ['Password', 'PIN'],
        ['Firewall', 'Antivirus'],
        ['Phishing', 'Spam'],
        ['Enkripsi', 'Hash'],
        ['WPA2', 'WPA3'],
        ['Backup', 'Arsip'],
        ['Virus', 'Worm'],
        ['MFA', 'Password Manager'],
        ['ARP Spoofing', 'IP Conflict']
      ]
    },
    {
      id: 'sekolah',
      name: 'Sekolah',
      icon: 'school',
      pairs: [
        ['Perpustakaan', 'Kantin'],
        ['Guru', 'Siswa'],
        ['Papan Tulis', 'Proyektor'],
        ['PR', 'Ujian'],
        ['Upacara', 'Apel'],
        ['Kelas', 'Lab'],
        ['Libur', 'Jam Kosong'],
        ['Ketua Kelas', 'Wakil Ketua'],
        ['Sepatu', 'Tas'],
        ['Bel', 'Papan Pengumuman']
      ]
    },
    {
      id: 'umum',
      name: 'Santai',
      icon: 'star',
      pairs: [
        ['Kucing', 'Anjing'],
        ['Bakso', 'Soto'],
        ['Kopi', 'Teh'],
        ['Sepeda', 'Motor'],
        ['Hujan', 'Pelangi'],
        ['Bulan', 'Bintang'],
        ['Pantai', 'Gunung'],
        ['Es Krim', 'Donat'],
        ['Buku', 'Pensil'],
        ['Malam', 'Pagi'],
        ['Nasi Goreng', 'Mie Goreng'],
        ['Bola', 'Raket']
      ]
    }
  ];

  window.NEK_SPY = { categories: categories };
})();

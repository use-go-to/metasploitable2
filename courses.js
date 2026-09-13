// courses.js — source unique des 29 cours de la roadmap.
// Ne pas éditer 'published' à la main : lancez `node sync-courses.js` après avoir
// ajouté/retiré un fichier lab-*.html, il le fait pour vous en vérifiant ce qui existe.
const courses = [
  {
    "id": 0,
    "title": "Reconnaissance générale — nmap",
    "categoryMain": "Méthodologie",
    "categorySub": "Recon",
    "technique": "Scan services, versions, scripts NSE",
    "difficulty": 1,
    "power": 1,
    "prereq": [],
    "file": null,
    "published": false,
    "description": "Cartographier tous les services ouverts et leurs versions avant toute idée d'attaque — le point de départ de chaque cours suivant."
  },
  {
    "id": 1,
    "title": "vsftpd 2.3.4 — Backdoor FTP",
    "categoryMain": "Service distant",
    "categorySub": "FTP",
    "technique": "Backdoor connue, 1 module",
    "difficulty": 1,
    "power": 4,
    "prereq": [],
    "file": "lab-vsftpd-backdoor.html",
    "published": true,
    "description": "Backdoor injectée dans le code source officiel. Un seul module Metasploit, root direct, aucune protection à contourner."
  },
  {
    "id": 2,
    "title": "Ingreslock — Backdoor triviale",
    "categoryMain": "Service distant",
    "categorySub": "Backdoor",
    "technique": "Connexion directe port 1524",
    "difficulty": 1,
    "power": 3,
    "prereq": [
      0
    ],
    "file": "lab-ingreslock-backdoor.html",
    "published": true,
    "description": "Un shell root ouvert en clair sur un port non standard — aucun exploit à charger, juste s'y connecter."
  },
  {
    "id": 3,
    "title": "Telnet — Bruteforce",
    "categoryMain": "Auth faible",
    "categorySub": "Telnet",
    "technique": "Dictionnaire hydra",
    "difficulty": 1,
    "power": 3,
    "prereq": [
      0
    ],
    "file": "lab-telnet-bruteforce.html",
    "published": true,
    "description": "Attaque par dictionnaire sur un protocole non chiffré, avec les identifiants par défaut de la machine comme premier réflexe."
  },
  {
    "id": 4,
    "title": "UnrealIRCd — Backdoor IRC",
    "categoryMain": "Service distant",
    "categorySub": "IRC",
    "technique": "Backdoor connue, 1 module",
    "difficulty": 2,
    "power": 4,
    "prereq": [
      0
    ],
    "file": "lab-unrealircd-backdoor.html",
    "published": true,
    "description": "Même famille d'incident que vsftpd — une archive piégée plutôt qu'une faille de code, sur un serveur IRC."
  },
  {
    "id": 5,
    "title": "SSH — Bruteforce",
    "categoryMain": "Auth faible",
    "categorySub": "SSH",
    "technique": "Dictionnaire hydra / msfadmin",
    "difficulty": 2,
    "power": 3,
    "prereq": [
      3
    ],
    "file": "lab-ssh-bruteforce.html",
    "published": true,
    "description": "Même logique que le bruteforce Telnet, sur un protocole chiffré cette fois — la différence ne change rien à l'attaque."
  },
  {
    "id": 6,
    "title": "MySQL — Root sans mot de passe",
    "categoryMain": "Auth faible",
    "categorySub": "BDD",
    "technique": "Connexion directe, énumération",
    "difficulty": 2,
    "power": 2,
    "prereq": [
      0
    ],
    "file": "lab-mysql-root.html",
    "published": true,
    "description": "Un compte root sans mot de passe sur le SGBD — connexion directe puis énumération des bases accessibles."
  },
  {
    "id": 7,
    "title": "Énumération SMB — enum4linux",
    "categoryMain": "Reconnaissance",
    "categorySub": "SMB",
    "technique": "Partages, users, versions (sans exploiter)",
    "difficulty": 2,
    "power": 1,
    "prereq": [
      0
    ],
    "file": "lab-smb-enum4linux.html",
    "published": true,
    "description": "Recon pure sur Samba : partages, utilisateurs, versions — sans exploiter, pour préparer les deux cours Samba suivants."
  },
  {
    "id": 8,
    "title": "SNMP — Fuite d'informations",
    "categoryMain": "Reconnaissance",
    "categorySub": "SNMP",
    "technique": "Communauté « public », snmpwalk",
    "difficulty": 2,
    "power": 1,
    "prereq": [
      0
    ],
    "file": "lab-snmp-snmpwalk.html",
    "published": true,
    "description": "Une communauté SNMP par défaut laissée ouverte suffit à extraire une quantité surprenante d'informations système."
  },
  {
    "id": 9,
    "title": "distccd — Exécution de code",
    "categoryMain": "Service distant",
    "categorySub": "RCE",
    "technique": "Exploit config par défaut",
    "difficulty": 2,
    "power": 4,
    "prereq": [
      0
    ],
    "file": "lab-distcc-exec.html",
    "published": true,
    "description": "Une configuration par défaut de distcc permet l'exécution de commandes arbitraires sans authentification."
  },
  {
    "id": 10,
    "title": "Samba — Symlink traversal",
    "categoryMain": "Service distant",
    "categorySub": "SMB",
    "technique": "Contournement de partage restreint",
    "difficulty": 3,
    "power": 2,
    "prereq": [
      7
    ],
    "file": null,
    "published": false,
    "description": "Contourner la restriction d'un partage Samba via un lien symbolique, pour accéder au reste du système de fichiers."
  },
  {
    "id": 11,
    "title": "Samba usermap_script",
    "categoryMain": "Service distant",
    "categorySub": "SMB",
    "technique": "CVE-2007-2447, injection de commande",
    "difficulty": 3,
    "power": 4,
    "prereq": [
      7
    ],
    "file": null,
    "published": false,
    "description": "Injection de commande via un champ de nom d'utilisateur mal filtré — accès système direct."
  },
  {
    "id": 12,
    "title": "NFS — Export mal configuré",
    "categoryMain": "Partage réseau",
    "categorySub": "NFS",
    "technique": "no_root_squash, montage + écriture",
    "difficulty": 3,
    "power": 4,
    "prereq": [
      0
    ],
    "file": null,
    "published": false,
    "description": "Un export NFS sans no_root_squash permet de monter le partage et d'y écrire avec des droits root locaux."
  },
  {
    "id": 13,
    "title": "DVWA — XSS réfléchie / stockée",
    "categoryMain": "Web",
    "categorySub": "XSS",
    "technique": "Payload direct, sans filtre",
    "difficulty": 2,
    "power": 2,
    "prereq": [
      0
    ],
    "file": null,
    "published": false,
    "description": "Injecter du script côté client sans aucun filtrage — la porte d'entrée classique du volet web du lab."
  },
  {
    "id": 14,
    "title": "DVWA — CSRF",
    "categoryMain": "Web",
    "categorySub": "CSRF",
    "technique": "Forge de requête, absence de token",
    "difficulty": 3,
    "power": 2,
    "prereq": [
      13
    ],
    "file": null,
    "published": false,
    "description": "Forger une requête qui agit à la place de la victime, en l'absence de jeton anti-CSRF."
  },
  {
    "id": 15,
    "title": "phpMyAdmin — Config vulnérable",
    "categoryMain": "Web",
    "categorySub": "Admin panel",
    "technique": "Accès direct via mauvaise config",
    "difficulty": 3,
    "power": 3,
    "prereq": [
      0
    ],
    "file": null,
    "published": false,
    "description": "Un panneau d'administration accessible sans restriction, exposé par une mauvaise configuration plutôt qu'une faille du logiciel."
  },
  {
    "id": 16,
    "title": "DVWA — Injection SQL visible",
    "categoryMain": "Web",
    "categorySub": "SQLi",
    "technique": "UNION-based, erreurs affichées",
    "difficulty": 3,
    "power": 3,
    "prereq": [
      0
    ],
    "file": null,
    "published": false,
    "description": "Injection SQL classique par UNION, avec des messages d'erreur qui guident directement l'attaquant."
  },
  {
    "id": 17,
    "title": "Mutillidae — Injection SQL aveugle",
    "categoryMain": "Web",
    "categorySub": "SQLi",
    "technique": "Boolean / time-based, sans retour direct",
    "difficulty": 5,
    "power": 3,
    "prereq": [
      16
    ],
    "file": null,
    "published": false,
    "description": "Même famille que le cours précédent, mais sans aucun retour direct — il faut déduire la donnée bit par bit ou par délai."
  },
  {
    "id": 18,
    "title": "DVWA — Command injection directe",
    "categoryMain": "Web",
    "categorySub": "Command Injection",
    "technique": "Aucun filtre, exécution immédiate",
    "difficulty": 3,
    "power": 4,
    "prereq": [
      0
    ],
    "file": null,
    "published": false,
    "description": "Un champ transmis tel quel à un appel système — exécution de commande immédiate, sans contournement à faire."
  },
  {
    "id": 19,
    "title": "Mutillidae — Command injection filtrée",
    "categoryMain": "Web",
    "categorySub": "Command Injection",
    "technique": "Contournement de blacklist ($IFS, encodage)",
    "difficulty": 5,
    "power": 4,
    "prereq": [
      18
    ],
    "file": null,
    "published": false,
    "description": "Même vecteur que le cours précédent, mais derrière une liste noire — il faut contourner le filtre plutôt que l'ignorer."
  },
  {
    "id": 20,
    "title": "DVWA — Inclusion de fichiers",
    "categoryMain": "Web",
    "categorySub": "LFI-RFI",
    "technique": "Traversal + inclusion distante",
    "difficulty": 4,
    "power": 4,
    "prereq": [
      16
    ],
    "file": null,
    "published": false,
    "description": "Traversée de répertoires puis inclusion d'un fichier distant pour faire exécuter du code par l'application."
  },
  {
    "id": 21,
    "title": "DVWA — Upload de fichier malveillant",
    "categoryMain": "Web",
    "categorySub": "File Upload",
    "technique": "Contournement de vérification d'extension",
    "difficulty": 4,
    "power": 4,
    "prereq": [
      16
    ],
    "file": null,
    "published": false,
    "description": "Déposer un fichier exécutable en contournant une vérification d'extension trop naïve, pour obtenir l'exécution de code."
  },
  {
    "id": 22,
    "title": "PostgreSQL — Creds faibles + UDF",
    "categoryMain": "Auth faible",
    "categorySub": "BDD",
    "technique": "Connexion + exécution via fonction",
    "difficulty": 4,
    "power": 4,
    "prereq": [
      6
    ],
    "file": null,
    "published": false,
    "description": "Identifiants faibles sur PostgreSQL, puis exécution de commande via une fonction définie par l'utilisateur."
  },
  {
    "id": 23,
    "title": "Java RMI registry",
    "categoryMain": "Service distant",
    "categorySub": "RMI",
    "technique": "CVE-2011-3556, désérialisation",
    "difficulty": 4,
    "power": 4,
    "prereq": [
      0
    ],
    "file": null,
    "published": false,
    "description": "Un registre RMI exposé sans restriction permet l'exécution de code via désérialisation."
  },
  {
    "id": 24,
    "title": "Tomcat Manager — Creds + WAR",
    "categoryMain": "Web",
    "categorySub": "App server",
    "technique": "Upload payload via manager",
    "difficulty": 4,
    "power": 4,
    "prereq": [
      21
    ],
    "file": "lab-tomcat-war.html",
    "published": true,
    "description": "Identifiants par défaut sur le gestionnaire Tomcat, puis déploiement d'une archive WAR piégée."
  },
  {
    "id": 25,
    "title": "TWiki — RCE",
    "categoryMain": "Web",
    "categorySub": "RCE",
    "technique": "Exploit applicatif spécifique",
    "difficulty": 5,
    "power": 4,
    "prereq": [
      16
    ],
    "file": null,
    "published": false,
    "description": "Exécution de code à distance via une faille propre à l'application TWiki."
  },
  {
    "id": 26,
    "title": "Post-exploitation — Binaires SUID",
    "categoryMain": "Post-exploitation",
    "categorySub": "Privesc",
    "technique": "Recherche + abus de binaire mal configuré",
    "difficulty": 4,
    "power": 5,
    "prereq": [],
    "prereqNote": "nécessite un shell obtenu (n'importe quel cours de puissance ≥ 3)",
    "file": null,
    "published": false,
    "description": "Depuis un shell utilisateur limité : chercher puis abuser un binaire SUID mal configuré pour passer root."
  },
  {
    "id": 27,
    "title": "Post-exploitation — Exploit kernel",
    "categoryMain": "Post-exploitation",
    "categorySub": "Privesc",
    "technique": "Exploit kernel Linux obsolète",
    "difficulty": 6,
    "power": 5,
    "prereq": [
      26
    ],
    "file": null,
    "published": false,
    "description": "Élévation de privilèges via un exploit ciblant un noyau Linux obsolète — l'alternative technique aux binaires SUID."
  },
  {
    "id": 28,
    "title": "Capstone — Chaîne complète",
    "categoryMain": "Post-exploitation",
    "categorySub": "Chaîne complète",
    "technique": "Web → shell → privesc → pivot réseau",
    "difficulty": 7,
    "power": 5,
    "prereq": [],
    "prereqNote": "tous les cours précédents",
    "file": null,
    "published": false,
    "description": "Enchaîner tout le lab de bout en bout : accès web initial, shell, élévation de privilèges, puis pivot vers un autre système."
  }
];

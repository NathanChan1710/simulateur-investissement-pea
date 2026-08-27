# (NOTHING) PEA Tracker // DCA 80/20 Serverless

Un tracker d'investissement personnel pour PEA (Plan d'Épargne en Actions) focalisé sur une stratégie **DCA (Dollar Cost Averaging)** avec deux ETF :
- **CW8.PA** : Amundi MSCI World UCITS ETF (Cible **80%**)
- **PAEEM.PA** : Amundi PEA MSCI Emerging Markets UCITS ETF (Cible **20%**)

L'application est **100% Serverless, gratuite et privée**, hébergée et automatisée entièrement dans l'écosystème GitHub.

---

## ⚡ Design System "Nothing OS"
- **Noir Profond (`#000000`)** & Cartes Gris Anthracite (`#111111`).
- **Dot Typography (`DotGothic16`)** pour les gros titres et les indicateurs clés.
- **Accents minimalistes** : Point rouge Nothing ("Glyph Record"), vert et rouge pâle pour les plus/moins-values.
- **Responsive Mobile-first** avec jauge d'allocation en temps réel, conseil intelligent de rééquilibrage DCA et graphique d'évolution Chart.js.

---

## 🛠️ Architecture Technique (Zero-Server)

```
PEA Tracker/
├── .github/workflows/
│   └── daily_update.yml      # Cron GitHub Actions (Lun-Ven 19h00 CET) + Deploy Pages
├── transactions.csv          # Source de vérité (vos achats saisis manuellement)
├── portfolio_data.json       # Données consolidées générées par le backend
├── update_portfolio.py       # Moteur Python (calcul PRU, yfinance, allocations)
├── requirements.txt          # Dépendances Python (pandas, yfinance)
├── index.html                # Interface Web statique Nothing OS
├── style.css                 # Feuilles de style Nothing OS Bento Grid
├── app.js                    # Logique frontend (fetch local, graphiques, métriques)
└── README.md
```

1. **Backend :** `update_portfolio.py` s'exécute automatiquement du lundi au vendredi à 19h00 CET via GitHub Actions.
2. **Données de marché :** Utilise `yfinance` pour récupérer les derniers cours de clôture de `CW8.PA` et `PAEEM.PA` sur Euronext Paris (avec gestion des week-ends et jours fériés).
3. **Frontend :** Page statique hébergée sur **GitHub Pages**, qui lit uniquement `portfolio_data.json` en local sans aucun appel API externe.

---

## 🚀 Mise en service sur GitHub

### 1. Activer GitHub Pages
1. Rendez-vous dans **Settings** > **Pages** de votre dépôt GitHub.
2. Dans la section **Build and deployment** > **Source**, sélectionnez **GitHub Actions**.

### 2. Autoriser les commits automatiques du Workflow
1. Rendez-vous dans **Settings** > **Actions** > **General**.
2. Dans la section **Workflow permissions**, sélectionnez **Read and write permissions**.
3. Cochez **Allow GitHub Actions to create and approve pull requests** et cliquez sur **Save**.

### 3. Ajouter une nouvelle transaction DCA
Dès que vous effectuez un achat mensuel, ajoutez simplement une ligne dans `transactions.csv` :
```csv
date,ticker,shares,price
2026-03-15,CW8.PA,5,545.00
2026-03-15,PAEEM.PA,20,21.80
```
Le workflow se déclenchera automatiquement pour recalculer votre PRU, votre allocation et déployer la nouvelle version sur GitHub Pages. Vous pouvez aussi le lancer manuellement via l'onglet **Actions** > **Update PEA Portfolio & Deploy** > **Run workflow**.

---

## 💻 Exécution en Local (Optionnel)

Pour tester le projet localement sur votre machine :

```bash
# 1. Installer les dépendances
pip install -r requirements.txt

# 2. Exécuter le script de calcul
python update_portfolio.py

# 3. Lancer un serveur web local
python -m http.server 8080
```
Ouvrez ensuite `http://localhost:8080` dans votre navigateur.

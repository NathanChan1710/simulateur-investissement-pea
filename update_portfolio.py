#!/usr/bin/env python3
"""
PEA Portfolio DCA Tracker - Backend Script
===========================================
Ce script lit transactions.csv, calcule le PRU et les métriques de chaque actif,
récupère les cours de clôture en direct via yfinance (avec gestion week-ends / jours fériés),
met à jour l'historique et sauvegarde les données consolidées dans portfolio_data.json.
"""

import json
import os
import sys
from datetime import datetime
import pandas as pd
import yfinance as yf

# Configuration des actifs cibles (Stratégie DCA PEA 80/20)
ASSET_CONFIG = {
    "CW8.PA": {
        "name": "Amundi MSCI World (CW8)",
        "target_allocation_pct": 80.0
    },
    "PAEEM.PA": {
        "name": "Amundi PEA Emerging Markets (PAEEM)",
        "target_allocation_pct": 20.0
    }
}

TRANSACTIONS_FILE = os.getenv("TRANSACTIONS_FILE", "transactions.csv")
OUTPUT_JSON_FILE = os.getenv("OUTPUT_JSON_FILE", "portfolio_data.json")


def load_transactions(filepath: str) -> pd.DataFrame:
    """Charge et valide le fichier transactions.csv."""
    if not os.path.exists(filepath):
        print(f"[ERREUR] Le fichier '{filepath}' est introuvable.")
        return pd.DataFrame(columns=["date", "ticker", "shares", "price"])

    try:
        df = pd.read_csv(filepath, parse_dates=["date"])
        # Nettoyage des colonnes et des types
        df.columns = df.columns.str.strip().str.lower()
        df["ticker"] = df["ticker"].astype(str).str.strip().str.upper()
        df["shares"] = pd.to_numeric(df["shares"], errors="coerce").fillna(0.0)
        df["price"] = pd.to_numeric(df["price"], errors="coerce").fillna(0.0)
        # Calcul du montant total par transaction
        df["total_cost"] = df["shares"] * df["price"]
        return df
    except Exception as e:
        print(f"[ERREUR] Échec de la lecture de {filepath}: {e}")
        return pd.DataFrame(columns=["date", "ticker", "shares", "price"])


def get_latest_price(ticker_symbol: str, fallback_price: float = 0.0) -> float:
    """
    Récupère le dernier cours de clôture disponible via yfinance.
    Gère les week-ends, jours fériés et indisponibilités de marché.
    """
    print(f"-> Récupération du cours pour {ticker_symbol}...")
    try:
        ticker = yf.Ticker(ticker_symbol)

        # 1. Tentative via fast_info (très rapide)
        if hasattr(ticker, "fast_info"):
            try:
                last_price = ticker.fast_info.get("lastPrice") or ticker.fast_info.get("regularMarketPrice")
                if last_price and last_price > 0:
                    return float(last_price)
            except Exception:
                pass

        # 2. Tentative via l'historique sur 7 jours (gestion des week-ends & jours fériés)
        hist = ticker.history(period="7d")
        if not hist.empty and "Close" in hist.columns:
            valid_closes = hist["Close"].dropna()
            if not valid_closes.empty:
                return float(valid_closes.iloc[-1])

    except Exception as e:
        print(f"   [AVERTISSEMENT] Erreur lors de la récupération de {ticker_symbol}: {e}")

    if fallback_price > 0:
        print(f"   [INFO] Utilisation du prix de secours ({fallback_price} €)")
        return fallback_price

    return 0.0


def calculate_portfolio(df_transactions: pd.DataFrame, existing_json: dict) -> dict:
    """Calcule toutes les métriques de valorisation, PRU, performance et allocations."""
    now_iso = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    today_str = datetime.now().strftime("%Y-%m-%d")

    assets_data = {}
    total_invested = 0.0
    total_current_value = 0.0

    # Analyse des transactions par Ticker
    for ticker, config in ASSET_CONFIG.items():
        ticker_df = df_transactions[df_transactions["ticker"] == ticker]

        total_shares = float(ticker_df["shares"].sum())
        invested_value = float(ticker_df["total_cost"].sum())

        # Calcul du PRU pondéré (Prix de Revient Unitaire)
        pru = (invested_value / total_shares) if total_shares > 0 else 0.0

        # Récupération du prix de secours depuis le JSON existant si disponible
        prev_asset = existing_json.get("assets", {}).get(ticker, {})
        fallback_price = prev_asset.get("current_price", pru)

        # Récupération du cours actuel
        current_price = get_latest_price(ticker, fallback_price=fallback_price)
        current_value = total_shares * current_price
        gain_loss = current_value - invested_value
        performance_pct = ((gain_loss / invested_value) * 100.0) if invested_value > 0 else 0.0

        assets_data[ticker] = {
            "name": config["name"],
            "shares": round(total_shares, 4),
            "pru": round(pru, 2),
            "current_price": round(current_price, 2),
            "invested_value": round(invested_value, 2),
            "current_value": round(current_value, 2),
            "gain_loss": round(gain_loss, 2),
            "performance_pct": round(performance_pct, 2),
            "target_allocation_pct": config["target_allocation_pct"],
            "current_allocation_pct": 0.0  # Calculé ci-dessous une fois le total connu
        }

        total_invested += invested_value
        total_current_value += current_value

    # Calcul des pourcentages d'allocation réels
    for ticker in assets_data:
        if total_current_value > 0:
            alloc = (assets_data[ticker]["current_value"] / total_current_value) * 100.0
            assets_data[ticker]["current_allocation_pct"] = round(alloc, 2)
        else:
            assets_data[ticker]["current_allocation_pct"] = 0.0

    # Calcul de la performance globale
    global_gain_loss = total_current_value - total_invested
    global_performance_pct = (
        (global_gain_loss / total_invested) * 100.0 if total_invested > 0 else 0.0
    )

    # Gestion de l'historique sans écraser les entrées précédentes
    history = existing_json.get("history", [])
    if not isinstance(history, list):
        history = []

    # Si l'historique est vide ou presque vide, reconstruire les jalons historiques
    # basés sur les dates des transactions passées
    if len(history) <= 1 and not df_transactions.empty:
        history_map = {item["date"]: item for item in history}
        df_sorted = df_transactions.sort_values(by="date")
        unique_dates = df_sorted["date"].dt.strftime("%Y-%m-%d").unique()

        cumul_shares = {t: 0.0 for t in ASSET_CONFIG}
        cumul_invested = 0.0

        for d_str in unique_dates:
            sub_df = df_sorted[df_sorted["date"].dt.strftime("%Y-%m-%d") <= d_str]
            day_invested = float(sub_df["total_cost"].sum())
            
            # Approximation de la valorisation aux dates d'achats basée sur les prix de transactions
            day_val = 0.0
            for t in ASSET_CONFIG:
                t_sub = sub_df[sub_df["ticker"] == t]
                if not t_sub.empty:
                    last_price = float(t_sub.iloc[-1]["price"])
                    total_t_shares = float(t_sub["shares"].sum())
                    day_val += total_t_shares * last_price

            day_pnl = day_val - day_invested
            day_pct = (day_pnl / day_invested * 100.0) if day_invested > 0 else 0.0

            if d_str not in history_map and d_str != today_str:
                history.append({
                    "date": d_str,
                    "total_value": round(day_val, 2),
                    "total_invested": round(day_invested, 2),
                    "gain_loss": round(day_pnl, 2),
                    "performance_pct": round(day_pct, 2)
                })

    # Vérifier si la date d'aujourd'hui est déjà présente dans l'historique
    today_entry_found = False
    new_entry = {
        "date": today_str,
        "total_value": round(total_current_value, 2),
        "total_invested": round(total_invested, 2),
        "gain_loss": round(global_gain_loss, 2),
        "performance_pct": round(global_performance_pct, 2)
    }

    updated_history = []
    for item in history:
        if item.get("date") == today_str:
            updated_history.append(new_entry)
            today_entry_found = True
        else:
            updated_history.append(item)

    if not today_entry_found:
        updated_history.append(new_entry)

    # Tri chronologique de l'historique
    updated_history.sort(key=lambda x: x.get("date", ""))

    # Assemblage de la structure finale
    portfolio_payload = {
        "metadata": {
            "last_updated": now_iso,
            "total_invested": round(total_invested, 2),
            "total_value": round(total_current_value, 2),
            "global_gain_loss": round(global_gain_loss, 2),
            "global_performance_pct": round(global_performance_pct, 2),
            "currency": "EUR",
            "status": "ONLINE"
        },
        "assets": assets_data,
        "history": updated_history
    }

    return portfolio_payload


def print_summary_table(data: dict):
    """Affiche un résumé console au style Nothing OS minimaliste."""
    meta = data["metadata"]
    print("\n" + "=" * 54)
    print("  [NOTHING OS] PEA DCA TRACKER // CONSOLE OUTPUT")
    print("=" * 54)
    print(f"  Dernière synchro   : {meta['last_updated']}")
    print(f"  Total Investi      : {meta['total_invested']:,.2f} €")
    print(f"  Valeur Actuelle    : {meta['total_value']:,.2f} €")
    sign = "+" if meta["global_gain_loss"] >= 0 else ""
    print(f"  Plus/Moins Value   : {sign}{meta['global_gain_loss']:,.2f} € ({sign}{meta['global_performance_pct']:.2f}%)")
    print("-" * 54)
    print("  ACTIFS EN PORTEFEUILLE :")
    for ticker, asset in data["assets"].items():
        p_sign = "+" if asset["gain_loss"] >= 0 else ""
        print(f"  • {ticker:<8} | {asset['shares']:>5.2f} parts | PRU: {asset['pru']:>7.2f} € | Cours: {asset['current_price']:>7.2f} €")
        print(f"    Val: {asset['current_value']:>8.2f} € | PnL: {p_sign}{asset['gain_loss']:>7.2f} € ({p_sign}{asset['performance_pct']:.2f}%) | Alloc: {asset['current_allocation_pct']:.1f}% (Cible: {asset['target_allocation_pct']}%)")
    print("=" * 54 + "\n")


def main():
    print(f"[START] Démarrage de la mise à jour du portefeuille PEA...")

    # Chargement du JSON existant pour préserver l'historique
    existing_json = {}
    if os.path.exists(OUTPUT_JSON_FILE):
        try:
            with open(OUTPUT_JSON_FILE, "r", encoding="utf-8") as f:
                existing_json = json.load(f)
                print(f"[OK] Fichier '{OUTPUT_JSON_FILE}' existant chargé ({len(existing_json.get('history', []))} points d'historique).")
        except Exception as e:
            print(f"[AVERTISSEMENT] Impossible de lire {OUTPUT_JSON_FILE}: {e}")

    # Lecture des transactions
    df_transactions = load_transactions(TRANSACTIONS_FILE)
    print(f"[OK] {len(df_transactions)} transactions chargées depuis '{TRANSACTIONS_FILE}'.")

    # Calcul du portefeuille
    portfolio_payload = calculate_portfolio(df_transactions, existing_json)

    # Sauvegarde dans portfolio_data.json
    try:
        with open(OUTPUT_JSON_FILE, "w", encoding="utf-8") as f:
            json.dump(portfolio_payload, f, indent=2, ensure_ascii=False)
        print(f"[SUCCÈS] '{OUTPUT_JSON_FILE}' mis à jour avec succès.")
    except Exception as e:
        print(f"[ERREUR] Échec de l'écriture dans {OUTPUT_JSON_FILE}: {e}")
        sys.exit(1)

    # Affichage du rapport en console
    print_summary_table(portfolio_payload)


if __name__ == "__main__":
    main()

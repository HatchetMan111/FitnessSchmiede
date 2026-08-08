"""
Berechnet Kalorien- und Makronährstoff-Richtwerte aus Körperdaten und dem
Ziel des aktuell aktiven Trainingsprogramms. Bewusst kein Tracking, keine
Mahlzeiten-Erfassung - nur eine seriöse Ausgangsgröße, an der man sich
orientieren kann. Trainingsziel und Ernährungsempfehlung hängen damit direkt
zusammen, statt zwei getrennte Welten zu sein.

Formel: Mifflin-St Jeor für den Grundumsatz (BMR), Aktivitätsfaktor für den
Gesamtumsatz (TDEE), anschließend eine Ziel-Anpassung (Überschuss/Defizit)
und eine an Krafttraining orientierte Protein-Vorgabe (g pro kg Körpergewicht).
"""

ACTIVITY_MULTIPLIERS = {
    "sedentary": 1.2,
    "light": 1.375,
    "moderate": 1.55,
    "active": 1.725,
    "very_active": 1.9,
}

ACTIVITY_LABELS = {
    "sedentary": "Überwiegend sitzend",
    "light": "Leicht aktiv (1-3x Sport/Woche)",
    "moderate": "Moderat aktiv (3-5x Sport/Woche)",
    "active": "Sehr aktiv (6-7x Sport/Woche)",
    "very_active": "Extrem aktiv (körperliche Arbeit + Sport)",
}

# Bekannte Ziel-Strings aus dem Onboarding-Formular (siehe frontend/js/onboarding.js)
# werden auf eine von vier Kategorien mit passender Kalorien-/Protein-Vorgabe
# abgebildet. Unbekannte/eigene Zieltexte fallen auf "fitness" (Erhaltung) zurück.
GOAL_CATEGORY = {
    "Kraftaufbau": "aufbau",
    "Muskelaufbau": "aufbau",
    "Abnehmen": "abnehmen",
    "Ausdauer & Fitness": "ausdauer",
}

CALORIE_ADJUSTMENT = {
    "aufbau": 350,  # leichter Überschuss für Muskelaufbau ohne unnötigen Fettaufbau
    "abnehmen": -450,  # moderates Defizit, nachhaltig statt Crash-Diät
    "ausdauer": 0,
    "fitness": 0,
}

PROTEIN_PER_KG = {
    "aufbau": 2.0,
    "abnehmen": 1.8,  # höher im Defizit, um Muskelmasse zu schützen
    "ausdauer": 1.4,
    "fitness": 1.6,
}

FAT_PER_KG = 0.9  # Basiswert, unabhängig vom Ziel


def bmr(weight_kg: float, height_cm: float, age: int, sex: str) -> float:
    base = 10 * weight_kg + 6.25 * height_cm - 5 * age
    return base + 5 if sex == "male" else base - 161


def calculate_targets(profile, goal: str) -> dict:
    category = GOAL_CATEGORY.get(goal, "fitness")

    tdee = bmr(profile.weight_kg, profile.height_cm, profile.age, profile.sex) * ACTIVITY_MULTIPLIERS[
        profile.activity_level
    ]
    calories = round(tdee + CALORIE_ADJUSTMENT[category])

    protein_g = round(PROTEIN_PER_KG[category] * profile.weight_kg)
    fat_g = round(FAT_PER_KG * profile.weight_kg)
    remaining_kcal = max(calories - protein_g * 4 - fat_g * 9, 0)
    carbs_g = round(remaining_kcal / 4)

    return {
        "goal_category": category,
        "tdee": round(tdee),
        "calories": calories,
        "protein_g": protein_g,
        "fat_g": fat_g,
        "carbs_g": carbs_g,
    }

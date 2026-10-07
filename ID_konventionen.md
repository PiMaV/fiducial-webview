### 1. Geometrische Basis

Das grundlegende Design der Plättchen folgt einem mathematisch "sauberen" Verhältnis, um krumme Werte zu vermeiden.

* **Verhältnis länger Plättchenkante zu Tag:** **5 : 2**
* **Resultat:** Der Umrechnungsfaktor ist **2,5**.
* **Beispiel:** Ein Plättchen mit **25 mm** Breite hat einen Tag mit **10 mm** Kantenlänge.
* **Quiet Zone:** Durch das Verhältnis 5:3 (Höhe) zu 2 (Tag) ist automatisch ausreichend weißer Rand (Quiet Zone) für die Detektion gegeben.

---

### 2. ID-Logik & Lookup Table (Kern-Spezifikation)

Wir nutzen die AprilTag-Familie **36h11** (IDs 0–586). Da der Zahlenraum begrenzt ist, nutzen wir eine **Block-Logik** statt einer direkten mathematischen Umrechnung (kein "ID durch 10 = cm").

**Die Kodierungs-Regel:**

1. **Hunderter-Stelle:** Definiert die **physikalische Größe**.
2. **Zehner/Einer-Stelle:** Definiert die **Funktion** (Lose vs. Fixiert).
* `00` bis `49`: **Loose (Lose):** Einzelne Plättchen, keine Relation zueinander, beliebige Platzierung.
* `50` bis `99`: **Fixed (Starr):** Teil eines fixen Werkzeugs (Lineal, Winkel, Rahmen), Software kennt relative Abstände.


#### Der Master Lookup Table

* **Basis-Verhältnis:** 5:3 (Plättchen) zu 2 (Tag)
* **Faktor Tag:** Breite  0,4
* **Faktor Höhe:** Breite  0,6

| ID-Bereich | Klasse | Breite | Höhe | Tag-Größe | Anwendungszweck |
| --- | --- | --- | --- | --- | --- |
| **100 - 149** | **S / Lose** | **15 mm** | **9 mm** | 6 mm | Finger, Zehen, Makro-Aufnahmen |
| **150 - 199** | **S / Fixed** | **15 mm** | **9 mm** | 6 mm | Mikro-Sonden, Zahnmedizin |
|  |  |  |  |  |  |
| **200 - 249** | **M / Lose** | **30 mm** | **18 mm** | **12 mm** | **Standard** (Wunden, Arm, Bein) |
| **250 - 299** | **M / Fixed** | **30 mm** | **18 mm** | **12 mm** | Standard-Lineale, Referenzrahmen |
|  |  |  |  |  |  |
| **300 - 349** | **L / Lose** | **50 mm** | **30 mm** | 20 mm | Körperstamm, Rücken, Übersicht |
| **350 - 399** | **L / Fixed** | **50 mm** | **30 mm** | 20 mm | Große Lineale, Bodenreferenz |
|  |  |  |  |  |  |
| **400 - 586** | **Special** | Variabel | Variabel | Variabel | 3D-Formkörper (Hex-Dome), Würfel |

**Kurzer Check der Dimensionen:**

1. **Small (15 x 9 mm):** Wie ein Fingernagel. Sehr klein, aber gut für Details.
2. **Medium (30 x 18 mm):** Etwa wie eine große Briefmarke oder ein kleiner Domino-Stein. **Perfekt handhabbar.**
3. **Large (50 x 30 mm):** Streichholzschachtel-Format (flach). Sehr gut sichtbar aus der Distanz.


*IDs 0-99 sind als Puffer/Debug reserviert.*
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

---

### 3. Bezugssystem (Slanted Edge & Farbmatrix)

Das Layout der Kalibrierflächen ist auf **S, M und L** identisch. Nur die Millimeter-Skala ändert sich mit der ID-Klasse (Tag-Kantenlänge aus der Lookup Table).

* **Einheit `u`:** `1 u` = halbe Tag-Kante = Plättchenbreite / 5.
  * S (Tag 6 mm): `1 u` = 3 mm
  * M (Tag 12 mm): `1 u` = 6 mm
  * L (Tag 20 mm): `1 u` = 10 mm
* **Ursprung zum Abholen:** untere linke Außenecke des erkannten AprilTags, in Drucklage (Slanted Edge links, Farbmatrix rechts, Lineal unten).
* **Achsen:** `+x` nach rechts, `+y` nach oben.
* **Plättchen-Ecke:** Die untere linke Außenecke des Plättchens liegt `0.75 u` weiter links und `0.5 u` weiter unten (Linealstreifen).

Ablauf nach Detektion: ID → Tag-Kante in mm → Ursprung an der unteren linken Tag-Ecke → Offset der gewünschten Fläche in `u` → Millimeter mit `mm = u × Tag-Kante / 2`.

---

### 4. Slanted Edge (links)

Schräge Grau-Kante am linken Plättchenrand für MTF-/Schärfe-Kalibrierung und Anti-Aliasing entlang der Kante. Quelle im Generator: `slanted_edge` / `_layer_slanted_edge`.

* **Höhe:** fünf gleich hohe Bänder über die Hauptfläche (`2.5 u`), nicht über den Linealstreifen. Jedes Band `0.5 u` hoch.
* **Lage im Tag-Ursprung:** von `y = 0` (Tag-Unterkante) bis `y = 2.5 u` (oberhalb der Tag-Oberkante). Die linke Bandkante liegt bei `x = −0.75 u` (Plättchenrand).
* **Schwärzung** von oben nach unten: **100 % / 20 % / 80 % / 20 % / 60 %**. Feste Palette im Generator, nicht in der ID kodiert.
* **Gedruckte sRGB-Werte** (aktueller SVG-Export): `#000000`, `#cccccc`, `#323232`, `#cccccc`, `#666666`. Die 80-%-Stufe wird als `#323232` geschrieben (`int(255 × 0.2)`), nicht als ideal `#333333`.
* **Schräge rechte Grenze:** oben `0.15 u` breit, unten (am Lineal) `0.25 u`. Über `2.5 u` Höhe ergibt das `0.10 u` horizontalen Versatz, etwa **2.3°** aus der Senkrechten (unten breiter). Die Kante liegt bewusst nicht auf Pixelzeilen, damit Anti-Aliasing Zwischenwerte liefert. Im SVG: `shape-rendering="geometricPrecision"`.

---

### 5. Farbmatrix / Colortower (rechts)

4×4-Farbfelder für Farbkalibrierung. Quelle: `COLOR_MATRIX_50X30` / `_layer_color_tower`. Druck-RGB und Abstimmreihenfolge auch in `PRINT_COLORS.md`.

* **Kachelgröße:** `0.4375 u` (`7/32` der Tag-Kante).
* **Lage:** Matrix bündig am rechten Plättchenrand; Unterkante auf der Tag-Unterkante.
* **Untere linke Ecke eines Feldes** (Zeile 0 = oben = Referenzzeile) relativ zum Tag-Ursprung:
  * `x = 2.50 u + Spalte × 0.4375 u`
  * `y = 1.3125 u − Zeile × 0.4375 u`
  * Millimeter: `mm = u × Tag-Kante / 2`

**Beispiel Rot** (Zeile 1, Spalte 0, RGB 255, 0, 0): Versatz `2.50 u` rechts und `0.875 u` hoch, Kante `0.4375 u`.

| Klasse | Tag-Kante | Versatz x | Versatz y | Feldkante |
| --- | --- | --- | --- | --- |
| L | 20 mm | 25 mm | 8.75 mm | 4.375 mm |
| M | 12 mm | 15 mm | 5.25 mm | 2.625 mm |
| S | 6 mm | 7.5 mm | 2.625 mm | 1.3125 mm |

#### Alle 16 Felder

| Zeile | Spalte | Name | RGB | x (u) | y (u) |
| --- | --- | --- | --- | --- | --- |
| 0 | 0 | ReferenceCyan | 0, 255, 255 | 2.50 | 1.3125 |
| 0 | 1 | ReferenceMagenta | 255, 0, 255 | 2.9375 | 1.3125 |
| 0 | 2 | ReferenceYellow | 255, 255, 0 | 3.375 | 1.3125 |
| 0 | 3 | ReferenceBlack | 0, 0, 0 | 3.8125 | 1.3125 |
| 1 | 0 | Red | 255, 0, 0 | 2.50 | 0.875 |
| 1 | 1 | Off-white | 252, 252, 252 | 2.9375 | 0.875 |
| 1 | 2 | Teal | 0, 128, 128 | 3.375 | 0.875 |
| 1 | 3 | Skin light | 255, 218, 185 | 3.8125 | 0.875 |
| 2 | 0 | Blue | 0, 0, 255 | 2.50 | 0.4375 |
| 2 | 1 | Mid gray | 128, 128, 128 | 2.9375 | 0.4375 |
| 2 | 2 | Dark neutral | 64, 64, 64 | 3.375 | 0.4375 |
| 2 | 3 | Green | 0, 255, 0 | 3.8125 | 0.4375 |
| 3 | 0 | Skin medium | 210, 180, 140 | 2.50 | 0.0 |
| 3 | 1 | Skin dark | 101, 67, 33 | 2.9375 | 0.0 |
| 3 | 2 | Orange | 255, 165, 0 | 3.375 | 0.0 |
| 3 | 3 | Violet | 128, 0, 128 | 3.8125 | 0.0 |

`x` / `y` = untere linke Feldecke relativ zur unteren linken Tag-Ecke; Feldkante überall `0.4375 u`.

---

### 6. Coordinate Ls (350–355)

Same 50×30 mm plate and the same local frame as every other flat marker. The measured point is the outer lower-left corner. +x runs along the ruler. +y runs up the short side. Tags on an L stay in print pose.

`coordinate-frame.json` is the source for the arm lengths. Printing lives in the printing repo (`generate_coordinate_l_sheet.py`). Full rules: `docs/coordinate-plates.md` there.

| IDs | Role on the sheet | Arm from the red corner |
| --- | --- | --- |
| 350, 351, 352 | Origin L: `ORIGIN`, `+X`, `+Y` | 230 mm, 170 mm |
| 353, 354, 355 | Optional station: `REF`, `+X`, `+Y`. L in the top-right, opening toward 350. Tags inside read the same way up as 350. | 180 mm, 130 mm |

356–399 stay available. The sheet does not print a distance from 350 to 353. That entry stays empty until it is measured. Sticker sheets still start at 300. This all-in-one sheet also prints loose plates 300–308, with no preset distance.

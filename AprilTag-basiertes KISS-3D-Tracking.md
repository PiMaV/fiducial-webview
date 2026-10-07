# AprilTag-basiertes KISS-3D-Tracking (Browser)

## Ziel

Ein **reines Client-Side (HTML/JS)** System zur **stabilen 3D-Rekonstruktion** von **3–20 AprilTags** aus einem Video-Sweep.
Keine SLAM-Komplexität, keine Backend-Abhängigkeiten, **KISS**.

---

## Ausgangslage

* AprilTag **Scanner + Generator** existieren bereits (HTML/WASM).
* Echtzeit-Detection läuft stabil (~20 Hz bei ~50 Tags).
* Marker besitzen **bekannte Kantenlängen**, aus der ID dekodierbar. ()
* Hardware ist schwach → Rechenbudget minimal halten.

---

## Grundannahmen

* Pinhole-Kameramodell (optional kalibriert).
* AprilTag-Detection liefert:

  * ID
  * Pose (R, t) relativ zur Kamera
* Marker-Pose ist **metrisch eindeutig**, da Markergröße bekannt.

---

## Koordinatensystem

* Marker mit **kleinster ID = Weltursprung**.
* Sobald Referenz-Marker sichtbar:

  * Welttransform = Inverse( Pose_cam→ref )
* Alle Marker werden relativ zu diesem Weltursprung gespeichert.

---

## Systemzustände

```text
IDLE     – wartet auf Reset / Start
CAPTURE  – sammelt Markerpositionen
LOCKED   – stabiles 3D-Modell
```

### Übergänge

* Reset → IDLE
* Referenz sichtbar → CAPTURE
* Alle Marker mehrfach gesehen → LOCKED

---

## Datenstruktur (minimal)

```js
world = {
  ref_id: 0,
  state: "CAPTURE",
  markers: {
    id: {
      pos: [x,y,z],
      confidence: n,
      last_seen: t
    }
  }
}
```

Maximal 10 Marker, keine Graphen, keine Historien.

---

## Frame-Pipeline (pro Bild)

1. Frame erfassen
2. AprilTags detektieren
3. Falls Referenz sichtbar → Welttransform berechnen
4. Marker-Positionen in Weltkoordinaten transformieren
5. Weltmodell aktualisieren
6. 3D-Ansicht rendern

Komplexität: **O(N)**

---

## Positions-Update (KISS-Filter)

Exponentielle Glättung:

```text
p_new = α · p_measured + (1−α) · p_old
```

* α ≈ 0.2–0.3
* confidence++ bei Sichtbarkeit
* Marker bleibt bestehen, auch wenn er temporär verschwindet

Kein Kalman-Filter, kein Optimierer.

---

## Sweep-Logik

* Marker müssen **nicht gleichzeitig sichtbar** sein.
* Video-Sweep erzeugt sukzessive Relationen:

  * A–B → B–C → C–D …
* Weltmodell wächst inkrementell.
* Markerpositionen bleiben persistent.

---

## Reset-Mechanismus

Ein Button:

```text
Reset → Weltmodell leeren → IDLE
```

Danach neue stabile Rekonstruktion.

---

## 3D-Visualisierung

* Separates Fenster / Canvas
* **Three.js** empfohlen
* Marker als Punkte oder Kugeln
* Kamera statisch, Welt rotiert optional

---

## Performance-Charakteristik

* Detection = Bottleneck
* Welt-Update + Render ≈ vernachlässigbar
* Geeignet für schwache Hardware
* Vollständig browser-tauglich

---

## Bewusst ausgeschlossen

* SLAM
* Bundle Adjustment
* Graph-Optimierung
* Multi-View-Triangulation
* Backend / Cloud / Persistenz

---

## Ergebnis

Ein **markerbasiertes, metrisches 3D-Memory**,
das:

* stabil ist
* realtimefähig ist
* im Browser läuft
* nach Reset neu aufgebaut werden kann

---

## Kurzform (für Cursor)

> Implementiere ein clientseitiges AprilTag-basiertes 3D-Tracking mit Referenz-Marker als Weltursprung, exponentieller Positionsglättung, einfachem Zustandsautomaten (IDLE/CAPTURE/LOCKED) und Three.js-Visualisierung. Keine SLAM-Komplexität, nur KISS.

---

Wenn du willst, kann ich dir im nächsten Schritt noch:

* eine **konkrete Dateistruktur**
* oder ein **Prompt-optimiertes Cursor-MD**
  bauen.

# Konzept und Idee: KISS-3D Tracker

## 1. Idee und Ziel

Der **KISS-3D Tracker** rekonstruiert eine **metrische 3D-Welt** aus einer Live-Kamera und AprilTag-Markern (36h11). Ohne Server, ohne Konfiguration der Referenz: Der Marker mit der **kleinsten ID** wird automatisch zum **Weltursprung**. Alle anderen Marker und die Kamera werden relativ zu diesem Referenz-Marker in Millimetern dargestellt.

**Kernidee:** Keep It Simple — Referenz durch ID-Reihenfolge, ein klares Weltmodell, ein einfacher Zustandsautomat, exponentielle Glaettung statt Kalman. Die 3D-Ansicht (Three.js) ist nur Darstellung; die Tracking-Logik bleibt getrennt und testbar.

---

## 2. Was der User sieht

- **Zwei Ansichten nebeneinander:** Links das Kamerabild mit erkannten Markern, rechts eine **Live-3D-Szene**: Plaettchen = Marker-Positionen im Raum, **orange** = Kamera. Der Ursprung der 3D-Welt ist der Referenz-Marker (kleinste ID).
- **Zustand:** IDLE → „Start capture“ → Kamera bewegen, Marker zeigen → wenn alle sichtbaren Marker mehrfach erkannt wurden: **LOCKED**. Ab dann: stabile Weltkoordinaten, Abstaende (Ref–next, Ref→alle, weitere Paare) in mm.
- **Reset:** Welt leeren, zurueck auf IDLE; erneutes „Start capture“ fuer neuen Sweep.

---

## 3. Konzept im Ueberblick

### 3.1 Referenz = kleinste ID

- Es wird **kein** Marker manuell als „Referenz“ gewaehlt.
- Unter allen **bereits gesehenen** Marker-IDs ist die **kleinste** die Referenz (Ref).
- Ref definiert den **Weltursprung (0, 0, 0)**. Die **Kamerapose** wird so berechnet, dass „Ref im Kamerabild“ einer Transformation **Welt → Kamera** entspricht; daraus folgt **Kamera → Welt** (T_world_cam = R, t). Alle Marker-Positionen werden von „Kamera-Koordinaten“ in „Welt-Koordinaten“ transformiert.

**Vorteil:** Keine Konfiguration, keine Auswahl. ID-Bereiche (100–199, 200–299, 300–399) sind ueber eine feste LUT mit Tag-Groessen (6 mm, 12 mm, 20 mm) verknuepft — damit ist die Pose metrisch.

### 3.2 Weltmodell

- **world.ref_id** — ID des Referenz-Markers (kleinste ID).
- **world.state** — IDLE | CAPTURE | LOCKED.
- **world.markers[id]** — pro Marker:
  - **pos** — [x, y, z] in mm (Weltkoordinaten, Ref = Ursprung).
  - **rot** — 3×3 Rotation (Welt), optional fuer spaetere Erweiterung.
  - **confidence** — wie oft der Marker schon erkannt wurde (zaehlt hoch pro Frame).
  - **last_seen** — Zeitstempel des letzten Sehens.

Groesse der Szene: typisch 3–20 Marker; das Modell bleibt O(N), ohne aufwaendige Strukturen.

### 3.3 Zustandsautomat

| Zustand   | Bedeutung |
|----------|-----------|
| **IDLE** | Keine Aufnahme. Welt kann leer sein (nach Reset). „Start capture“ wechselt nach CAPTURE. |
| **CAPTURE** | Ref ist definiert (kleinste gesehene ID). Pro Frame: Kamerapose aus Ref, alle Detections in Welt transformieren, Marker-Positionen und confidence updaten. |
| **LOCKED** | Alle **aktuell im Weltmodell** vorhandenen Marker haben mindestens **k** Frames confidence (z.B. k = 10). Ab dann: Welt „fest“, Abstaende werden angezeigt und koennen mit dem Lineal verglichen werden. |

- **Ref verschwindet waehrend CAPTURE:** Die letzte Kamerapose (T_world_cam) bleibt erhalten; neue Marker werden weiter transformiert, solange R und t noch gesetzt sind. Kein automatischer Rücksprung zu IDLE.
- **Reset:** explizit durch User → IDLE, world geleert; „Start capture“ wieder noetig.

---

## 4. Datenfluss (pro Frame)

1. **Eingang:** Video-Frame → AprilTag-Detection (bereits im Scanner vorhanden) → Liste von **{ id, corners }** (4 Ecken pro Marker in Pixel).
2. **Kamera-Matrix K:** Aus Kalibrierung (localStorage, calibrate.html) oder Fallback **defaultCamera(width, height)** (Pinhole, fx ~ Bildbreite).
3. **Tag-Groesse:** Aus **LUT (ID → mm)**. IDs 100–199 → 6 mm, 200–299 → 12 mm, 300–399 → 20 mm (und ggf. 400–586 variabel).
4. **Pose pro Marker:** Aus 4 Ecken + Tag-Groesse + K → **Homographie (4-Punkt-DLT)** → Zerlegung in **R, t** (Tag in Kamerakoordinaten, mm). Dafuer: **kiss3d-pose.js** (poseFromCorners).
5. **Referenz-Pose:** Pose des Ref-Markers (R_cam_ref, t_cam_ref) → **T_world_cam** = Inverse: Rotation transponieren, Translation umrechnen. Optional: **t_world_cam** und ggf. **R_world_cam** exponentiell glaetten (α, z.B. 0,13).
6. **Marker in Welt:** Fuer jeden erkannten Marker: Pose in Kamera → **toWorld(pos_cam)** = R_world_cam · pos_cam + t_world_cam. Position **pos** im Weltmodell mit exponentiellem Filter updaten: pos_new = α · pos_measured + (1−α) · pos_old.
7. **LOCKED-Pruefung:** Wenn alle Eintraege in world.markers confidence ≥ Schwellwert → state = LOCKED.
8. **Ausgang:** world + Kamerapose → **Three.js-Szene**: Marker als Objekte (Plaettchen/Kugeln), Kamera als orangener Rahmen; plus Tabelle (ID, X, Y, Z, Abstaende) und optional FPS-Graph.

---

## 5. Wichtige Bausteine

### 5.1 LUT (ID → Tag-Kante mm)

- **id-tag-size-lut.json** / **kiss3d-state.js**: Starre Bereiche 100–199 (6 mm), 200–299 (12 mm), 300–399 (20 mm). Ohne reale Groesse keine metrische Pose; die LUT ist damit zentral fuer das Konzept.

### 5.2 Pose aus vier Ecken (kiss3d-pose.js)

- **Homographie** von 4 Objektpunkten (Tag-Ebene z=0, ±tagSize/2) auf 4 Bildpunkte (Ecken in Pixel).
- **Zerlegung** H und K → R, t (Tag in Kamerakoordinaten, mm). Kein PnP mit vielen Punkten; minimal und ausreichend fuer flache Marker.

### 5.3 Zustandsautomat und Welt-Update (kiss3d-state.js)

- **updateFromDetections(markers, now):**  
  - In IDLE: nichts aendern.  
  - Ref_id = Minimum aller vorkommenden IDs.  
  - Kamerapose aus Ref-Pose berechnen und (optional) glaetten.  
  - Jeden erkannten Marker in Welt transformieren und pos/confidence/rot updaten.  
  - Am Ende: bei CAPTURE pruefen, ob alle Marker confidence ≥ LOCKED_MIN_CONFIDENCE → LOCKED.

### 5.4 Abbildungs-Korrektur (Scale computed → real)

- Systematischer Massstabfehler (z.B. 200 mm berechnet = 206 mm real) wird durch einen **Korrekturfaktor** ausgeglichen: **real = berechnet × scaleCorrection** (z.B. 206/200). In der UI einstellbar; X, Y, Z und alle Abstaende (Ref–next, Ref→alle, weitere Paare) werden mit diesem Faktor angezeigt. Verbessert die Uebereinstimmung mit dem physischen Lineal.

### 5.5 Stabilisierung (Glaettung)

- **Marker-Positionen:** exponentieller Filter (α) — ruhige Plaettchen-Positionen.
- **Kamerapose:** **t_world_cam** ebenfalls exponentiell glaetten reduziert Springen der orangenen Kamera in der 3D-Ansicht. **R_world_cam** optional per Slerp glaetten. Optional spaeter: Mehr-Marker-Referenzierung (PnP ueber alle sichtbaren Marker) fuer noch stabilere Kamera.

---

## 6. Verwendung und Verifikation

- **Sweep:** Kamera starten, „Start capture“, mehrere Marker nacheinander ins Bild bringen. Nach LOCKED: Tabelle mit X, Y, Z (mm) und Abstaenden.
- **Ref–next:** Abstand Ref zum naechsten Marker (nach ID) — mit Lineal vergleichen.
- **Ref→alle:** Abstaende von Ref zu jedem anderen Marker — fuer mehrere Strecken auf einen Blick.
- **Weitere Paare:** Abstaende zwischen 2.–2., 2.–3., 3.–3. usw. — zum Pruefen weiterer Strecken (z.B. 2–4 Marker).
- **Scale (computed→real):** Faktor so setzen (z.B. 1,03), dass angezeigte mm mit dem Lineal uebereinstimmen.

---

## 7. Technische Entscheidungen (KISS)

| Aspekt            | Entscheidung |
|-------------------|--------------|
| Referenz          | Kleinste ID, keine Konfiguration. |
| Weltmodell        | Einfaches Objekt world.markers[id], O(N). |
| Zustaende         | Drei Zustaende IDLE/CAPTURE/LOCKED, klare Uebergaenge. |
| Filter            | Exponentiell (α), kein Kalman. |
| Pose              | Homographie + Zerlegung aus 4 Ecken, kein volles PnP-Bundle. |
| 3D-Darstellung    | Three.js nur fuer Anzeige; Tracking-Logik in kiss3d-state.js / kiss3d-pose.js. |
| Kalibrierung      | K aus calibrate.html (localStorage) oder defaultCamera; LUT fest. |

---

## 8. Dateien und Verantwortlichkeiten

| Datei / Modul        | Rolle |
|----------------------|--------|
| **tracker3d.html**   | UI: Kamera, 3D-Canvas, State-Panel, Buttons (Start, Stop, Start capture, Reset), FPS, Scale-Correction. Bindet Detection, kiss3d-state, kiss3d-pose und Three.js zusammen. |
| **kiss3d-state.js**  | LUT (getTagSizeMm), Weltmodell (world), Zustandsautomat (IDLE/CAPTURE/LOCKED), updateFromDetections, Kamerapose (R_world_cam, t_world_cam), Glaettung, Scale-Correction, reset/startCapture. |
| **kiss3d-pose.js**   | poseFromCorners (Homographie + R,t aus K), defaultCamera. |
| **id-tag-size-lut.json** | Optionale Quelle fuer ID-Bereiche und Tag-Groessen (kann in state eingelesen oder fest verdrahtet sein). |

Damit ist das **Konzept** des 3D-Trackers: eine minimale, klare Idee (Ref = kleinste ID, Welt in mm, drei Zustaende, Glaettung und Korrekturfaktor) mit klarer Aufteilung in Pose, State und Darstellung.

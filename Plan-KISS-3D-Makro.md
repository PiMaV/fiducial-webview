# Plan: KISS-3D-Tracking – Makro-View & LUT

## 1. Kurzpruefung des Konzepts (AprilTag KISS-3D)

**Passt gut zusammen:**
- Referenz = kleinste ID → Weltursprung: nutzt ID-Reihenfolge, keine Extra-Konfiguration.
- Weltmodell `world.markers[id]` mit `pos`, `confidence`, `last_seen`: reicht fuer 3–20 Marker, O(N).
- Zustaende IDLE → CAPTURE → LOCKED: klare Uebergaenge (Reset, Ref sichtbar, "alle mehrfach").
- Exponentieller Filter statt Kalman: wenig Code, stabil genug fuer Sweep.
- Three.js nur fuer Anzeige, Tracking-Logik bleibt getrennt.

**Zu klaeren (Struktur, kein Code):**
- **"Alle Marker mehrfach gesehen → LOCKED"**: Schwellwert fuer `confidence` oder Mindestanzahl Frames? Einfache Regel waere z.B. "jeder Marker mind. k Frames" oder "alle sichtbaren Marker confidence ≥ n".
- **Referenz verschwindet waehrend CAPTURE**: Dokument sagt "Welttransform = Inverse(Pose_cam→ref)" – wenn Ref weg ist, letzte Welttransform weiter nutzen (wie vorgesehen), kein Zustandswechsel noetig.
- **3D-Canvas**: "Separates Fenster/Canvas" – technisch ein zweites Canvas-Element oder iframe; Architektur: eine HTML-Seite mit zwei Bereichen (Scanner + 3D) oder Tabs.

**Struktur-Makro (ohne Code):**
1. **Eingang:** Video/Stream → AprilTag-Detection (bereits vorhanden).
2. **Kern:** Zustandsautomat (IDLE/CAPTURE/LOCKED) + Weltmodell (ref_id, state, markers).
3. **Pro Frame:** Ref sichtbar → T_world_cam; alle Detections → in Welt transformieren → Marker-Update (Position + confidence).
4. **Ausgang:** Weltmodell → Three.js-Szene (Punkte/Kugeln), Reset-Button → IDLE, Welt leeren.
5. **Metrik:** Tag-Kantenlaenge pro Marker aus **LUT (ID → mm)**; LUT kommt aus ID-Konventionen.

---

## 2. LUT aus ID-Konventionen (starr, klein)

Aus `ID_konventionen.md` wird nur das abgeleitet, was das 3D-Tracking **zwingend** braucht: **ID-Bereich → Tag-Kantenlaenge in mm** (metrische Pose ist dann eindeutig). Fixed/Loose und Anwendungszweck sind fuer die reine 3D-Rekonstruktion optional; Groesse (Breite/Hoehe Plaettchen) kann bei Bedarf aus derselben Tabelle kommen.

**Starre, minimale LUT (nur Tag-Groesse):**

| ID von | ID bis | Tag-Kante (mm) |
|--------|--------|----------------|
| 100    | 199    | 6              |
| 200    | 299    | 12             |
| 300    | 399    | 20             |
| 400    | 586    | (variabel)     |

IDs 0–99: reserviert; bei Verwendung in 3D-Kontext entweder ignorieren oder einen Fallback (z.B. 6 mm) definieren.

**Erweiterung um eine Zeile pro Zeile (optional, falls spaeter Klasse/Fixed noetig):**  
Man koennte die gleiche Tabelle um Spalten "Klasse" (S/M/L/Special) und "Fixed" (ja/nein) erweitern – fuer KISS-3D reicht zunaechst die reine **Tag-Kante (mm)**.

---

## 3. Naechste Schritte (wenn du einverstanden bist)

1. ~~**LUT** als feste Struktur~~ → erledigt (`id-tag-size-lut.json`).
2. ~~**Zustandsautomat + Weltmodell**~~ → kiss3d-state.js, tracker3d.html.
3. ~~**Schwellwerte**~~ → LOCKED_MIN_CONFIDENCE = 10, α = 0.25.
4. ~~**3D-Visualisierung**~~ → Three.js Live-Ansicht in tracker3d.html (Ref = Ursprung, OrbitControls).

Wenn du willst, als naechstes: **konkrete Dateistruktur** (welche Files, welche Verantwortlichkeiten) ohne Code.

---

## 4. Wie am besten weitermachen (Optionen)

**A – Dateistruktur zuerst (empfohlen)**  
Zuerst festlegen: welche Dateien, welche Verantwortlichkeiten, wo LUT/State/3D leben. Danach Implementierung schrittweise (erst State + LUT-Lookup, dann Frame-Pipeline, dann 3D). Klar getrennt, wenig Nacharbeit.

**B – In scanner.html erweitern**  
3D-Logik und State direkt in `scanner.html` einbauen (neuer Bereich/ Tab fuer 3D, ein Script-Block mehr). Schnell sichtbar, wird aber schnell unuebersichtlich bei State + Three.js.

**C – Eigenes Modul „tracker3d“**  
Neue Seite z.B. `tracker3d.html`, die den bestehenden Scanner (iframe oder geteiltes Detection-Skript) nutzt und nur Weltmodell + 3D-Canvas enthaelt. Scanner bleibt unveraendert; 3D-Feature klar getrennt.

**Technischer Klärpunkt:**  
Scanner liefert heute pro Marker nur **id + corners** (4 Ecken). Fuer metrische Pose (R, t) brauchen wir entweder (1) Pose-Ausgabe aus dem AprilTag-WASM (falls vorhanden), oder (2) Pose-Schätzung aus Ecken + Tag-Groesse (LUT) + Kameraparameter. Das beeinflusst, ob wir z.B. ein kleines „poseFromCorners“-Modul brauchen.

**Vorschlag:** **A** – zuerst **konkrete Dateistruktur** (inkl. wo Pose herkommt), dann Implementierung in kleinen Schritten. Wenn du willst, schreibe ich im naechsten Schritt die Dateistruktur (Files + Verantwortlichkeiten) konkret aus.

---

## 5. Repo-Strategie (public repo, GitHub Pages)

**Ausgangslage:** Repo ist oeffentlich, wird ueber GitHub Pages gehostet. Unfertige Aenderungen oder ein sichtbarer „WIP“-Branch sollen nicht ins Remote – erst committen, wenn das 3D-Feature abgeschlossen ist.

**Vorgehen:**

- **Lokal entwickeln, nicht pushen bis fertig**  
  Alle 3D-Arbeiten (Plan, LUT, spaeter Code) entweder auf **main** oder in einem **lokalen Branch** machen – diesen Branch **nicht** pushen, bis die Feature-Implementierung fertig und review-ready ist. Dann: Branch pushen + PR + Merge (oder direkt auf main committen und pushen). So erscheint im Repo kein unfertiger Branch.

- **Option: Nur bei Fertigstellung pushen**  
  Wenn du auf main arbeitest: 3D-Dateien lokal anlegen/aendern, erst einen Commit (oder mehrere) machen, wenn das Feature durchgaengig funktioniert und du es oeffentlich haben willst. Dann einmal pushen – auf GitHub steht nur der fertige Stand.

- **Option: Lokaler Feature-Branch**  
  Branch z.B. `feature/kiss-3d-tracking` lokal anlegen und dort alle Aenderungen machen. Push dieses Branch erst, wenn du den PR oeffnen willst („feature complete“). Vorteil: main bleibt bis zum Merge unberuehrt; auf GitHub ist bis dahin kein neuer Branch sichtbar.

**Kurz:** Kein unfertiger Branch im Repo = einfach den Branch (oder main) erst pushen, wenn das 3D-Feature fertig ist. Alles davor bleibt lokal.

---

## 6. Positionspruefung (ob Werte stimmen)

- **Ref = Weltursprung:** Marker mit kleinster ID hat Position (0, 0, 0) bzw. nahe 0 nach Glaettung.
- **Abstand Ref–naechster:** In der UI wird "Ref–next: XX mm" angezeigt (korrigiert, s.u.). Mit Lineal vergleichen.
- **Ref→alle:** Abstaende von Ref zu jedem anderen Marker (korrigiert), zum direkten Vergleich mit dem Lineal.
- **Weitere Paare:** Abstaende zwischen 2.–2., 2.–3., 3.–3. usw. (bis zu 4 Marker), um mehrere Strecken gegeneinander zu pruefen.
- **Sweep:** Mehrere Marker nacheinander zeigen, LOCKED abwarten; Abstaende in der Tabelle (X,Y,Z) sind mit Korrekturfaktor angezeigt.

**Abbildungs-Korrektur:** Leichter systematischer Massstabfehler (z.B. 65 mm berechnet = 67 mm real, 200 mm = 206 mm real) wird durch einen **Korrekturfaktor** ausgeglichen: real = berechnet × Faktor (z.B. 206/200 = 1,03). In der UI einstellbar (Scale berechnet→real); X,Y,Z und alle Abstaende werden mit diesem Faktor angezeigt.

---

## 7. Kamera springt – Stabilisierung (Diskussion)

**Beobachtung:** Plaettchen-Positionen (relativ zum Ref-Ursprung) sind gut; die **Kamera** (orangener Rahmen in 3D) springt stark.

**Ursache:**  
- Marker-Positionen werden **geglättet** (exponentiell, α ≈ 0,25).  
- Die **Kamerapose** (T_world_cam = R, t) wird **jeden Frame neu** nur aus der Ref-Detection berechnet und **nicht** geglaettet. Ecken-Jitter, leichte Pose-Aenderungen → t_world_cam und R_world_cam springen von Frame zu Frame.

**Idee „Relationen mehrfach referenzieren und stabiler machen“:**

1. **Kamerapose glaetten (einfach)**  
   - **t_world_cam** wie die Marker-Position exponentiell glaetten:  
     `t_new = α · t_measured + (1−α) · t_old`.  
   - **R_world_cam** entweder:  
     - nur bei Bedarf glaetten (z.B. Slerp zwischen alter und neuer Rotation), oder  
     - zunaechst nur **t** glaetten und R unveraendert lassen (weniger Aufwand, Kamera-Position im 3D-Bild wird ruhiger).

2. **Mehrfach-Referenzierung**  
   - Statt nur die Ref zu nutzen: Wenn **mehrere Marker** sichtbar sind, deren **Weltpositionen** schon geglaettet sind, kann die Kamerapose so geschaetzt werden, dass sie zu **allen** sichtbaren Markern passt (kleines Least-Squares / PnP ueber alle sichtbaren Marker). Das „referenziert“ die Geometrie mehrfach und nutzt die schon stabilen Marker-Positionen.  
   - Aufwand: hoeher (PnP oder aehnliches ueber N Punkte, Rotation + Translation optimieren).

3. **Pragmatische Reihenfolge**  
   - **Schritt 1:** Nur **t_world_cam** exponentiell glaetten (gleiches α wie bei Markern). Schnell umgesetzt, orange Kamera sollte deutlich ruhiger werden.  
   - **Schritt 2 (optional):** Rotation R_world_cam mit Slerp glaetten, falls die Orientierung noch zittert.  
   - **Schritt 3 (optional):** Mehr-Marker-Referenzierung, wenn du die zusaetzliche Stabilisierung willst.

Wenn du willst, setzen wir zuerst **Schritt 1** (Glaettung von t_world_cam) um und beobachten, ob das Springen ausreicht.

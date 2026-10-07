# KISS-3D Tracker – Status & Session Summary

## Current status (summary)

The **tracker** (`tracker3d.html` + `kiss3d-state.js`) provides:

- **World model:** Ref = smallest ID = origin (0,0,0); all marker positions in mm; state IDLE → CAPTURE → LOCKED.
- **Multi-marker camera pose:** Rotation averaged over all visible markers (quaternion average); **translation anchored to Ref only** (no drift; X/Y/Z in table stay in a sane range).
- **Stability (like debug-pose):** **Window** (default 3) = sliding average over last N frames for camera T; **R fc** (default 1 Hz) = quaternion lowpass for camera R and for each marker’s rotation (rx, ry, rz). Same idea as debug-pose “Window 3, R fc 1”.
- **Frustum:** Drawn from calibration **K** and current resolution (FOV from K); side faces lightly tinted; no fixed 25°.
- **Camera-centric view (optional):** Origin at camera, Z = view axis; camera and frustum fixed; markers in camera space; **Cam offset** shifts origin to the right; pan enabled.
- **UI:** FOV (cal.) from K; X/Y/Z table with world (ref=origin) tooltip; state/ref/distances; smoothing α, Window, R fc; far plane 50k so zoom-out does not clip.
- **Updates only when 3D view visible:** If the 3D container is off-screen, state UI and 3D render are not updated (no “counting up” while scrolled away).

Known limitations: 3D marker positions can still jitter a bit; no traces or recorded distances yet; no fixed “room” coordinate system. See TODO below.

---

## Session summary (what was implemented)

1. **Frustum from calibration + resolution**  
   Frustum corners and FOV derived from stored K (fx, fy, cx, cy) and current video size; fallback 25° if no K. FOV shown in UI (H°/V°).

2. **Origin = Ref marker**  
   Orbit target and world coordinates: Ref (smallest ID) = origin. Translation **t_world_cam** computed only from Ref pose (no averaging over marker positions → no drift; X/Y/Z stay “normal”).

3. **Multi-marker pose**  
   Camera **rotation** = quaternion average over all visible markers. **Translation** = from Ref only (or keep previous if Ref not visible).

4. **Camera-centric view**  
   Option: origin at camera, Z = view axis; camera + frustum fixed at origin; markers in camera frame; **Cam offset** (default 80) shifts scene so camera is to the right; pan enabled.

5. **Stability (Window + R fc)**  
   - **Window** (default 3): sliding average of last N `t_new` (from Ref) before applying exponential smoothing.  
   - **R fc** (default 1 Hz): `alphaR = 1 - exp(-2*pi*fc*dt)`; used for camera R and for each marker’s **rec.rot** via quat lowpass → stable rz (and rx, ry).

6. **Visibility-based updates**  
   When the 3D view container is not in the viewport, `updateStateUI`, `updateScene3D`, FOV, and perf timeline are skipped so values do not “count up” while the view is hidden.

7. **Far plane**  
   PerspectiveCamera far plane set to 50 000 so camera and markers remain visible when zooming out.

8. **Table labels**  
   X/Y/Z columns have tooltips “World X (ref=origin)” etc. Display smoothing (DISPLAY_SMOOTH_ALPHA) and 3D marker alpha tuned for calmer display.

---

## Tracker TODO / ideas for next session

- **Traces of individual markers**  
  Draw trails (e.g. line strips) for each marker’s position over time in the 3D view.

- **Recorded distances between markers**  
  Store and display history of distances (Ref–next, Ref→all, other pairs), e.g. for verification or export.

- **Smoothing and fixed camera position**  
  Further stabilize displayed values; consider a **fixed reference frame** (e.g. “room”) instead of only camera-centric: e.g. **square-shaped viewpoint** with explicit camera frustum and coordinate axes, and possibly **positions drawn on/near the markers** in the 3D view.

- **Defined 3D room**  
  Goal: a **defined 3D space** in which the user can move (e.g. orbit/pan) and in the **live image** see positions represented **relative to each other** in a clear, stable way (room origin, axes, optional grid or bounds).

- **Next steps**  
  Refine the above (traces, distances, room frame, labels on markers); continue in the next session.

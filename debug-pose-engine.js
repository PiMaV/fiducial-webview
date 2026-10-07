/**
 * Alle Mathematik und Berechnungen fuer debug-pose.html.
 * Nur reine Logik – kein DOM. Display bleibt im HTML.
 */
(function (global) {
    'use strict';
  
    function rotToEulerDeg(R) {
      if (!R || R.length < 9) return null;
      var m00 = R[0], m10 = R[3], m20 = R[6];
      var m01 = R[1], m11 = R[4], m21 = R[7];
      var m02 = R[2], m12 = R[5], m22 = R[8];
      var sy = Math.hypot(m00, m10);
      var singular = sy < 1e-6;
      var rx, ry, rz;
      if (!singular) {
        rx = Math.atan2(m21, m22);
        ry = Math.atan2(-m20, sy);
        rz = Math.atan2(m10, m00);
      } else {
        rx = Math.atan2(-m12, m11);
        ry = Math.atan2(-m20, sy);
        rz = 0;
      }
      var rad2deg = 180 / Math.PI;
      return { rx: rx * rad2deg, ry: ry * rad2deg, rz: rz * rad2deg };
    }
  
    function eulerToMat3(rx, ry, rz) {
      var rad = Math.PI / 180;
      var cx = Math.cos(rx * rad), sx = Math.sin(rx * rad);
      var cy = Math.cos(ry * rad), sy = Math.sin(ry * rad);
      var cz = Math.cos(rz * rad), sz = Math.sin(rz * rad);
      var Rx = [1, 0, 0, 0, cx, -sx, 0, sx, cx];
      var Ry = [cy, 0, sy, 0, 1, 0, -sy, 0, cy];
      var Rz = [cz, -sz, 0, sz, cz, 0, 0, 0, 1];
      var mul = function (A, B) {
        return [
          A[0] * B[0] + A[1] * B[3] + A[2] * B[6], A[0] * B[1] + A[1] * B[4] + A[2] * B[7], A[0] * B[2] + A[1] * B[5] + A[2] * B[8],
          A[3] * B[0] + A[4] * B[3] + A[5] * B[6], A[3] * B[1] + A[4] * B[4] + A[5] * B[7], A[3] * B[2] + A[4] * B[5] + A[5] * B[8],
          A[6] * B[0] + A[7] * B[3] + A[8] * B[6], A[6] * B[1] + A[7] * B[4] + A[8] * B[7], A[6] * B[2] + A[7] * B[5] + A[8] * B[8]
        ];
      };
      return mul(mul(Rz, Ry), Rx);
    }
  
    function norm180(v) {
      if (typeof v !== 'number' || isNaN(v)) return v;
      while (v > 180) v -= 360;
      while (v < -180) v += 360;
      return v;
    }
  
    function norm90(v) {
      if (typeof v !== 'number' || isNaN(v)) return v;
      while (v > 90) v -= 180;
      while (v < -90) v += 180;
      return v;
    }
  
    function unwrapAngle(a, prev) {
      if (typeof a !== 'number' || isNaN(a)) return a;
      if (typeof prev !== 'number' || isNaN(prev)) return a;
      var d = a - prev;
      while (d > 180) { a -= 360; d = a - prev; }
      while (d < -180) { a += 360; d = a - prev; }
      return a;
    }
  
    /** rx, ry: Periode 180 ([-90,90]). Bei Sprung >90 entpacken. */
    function unwrapAngle90(a, prev) {
      if (typeof a !== 'number' || isNaN(a)) return a;
      if (typeof prev !== 'number' || isNaN(prev)) return a;
      var d = a - prev;
      while (d > 90) { a -= 180; d = a - prev; }
      while (d < -90) { a += 180; d = a - prev; }
      return a;
    }
  
    function computeStd(arr, key, n) {
      var len = Math.min(arr.length, n || 60);
      if (len < 2) return NaN;
      var start = arr.length - len;
      var sum = 0, cnt = 0;
      for (var i = start; i < arr.length; i++) {
        var v = arr[i][key];
        if (typeof v === 'number' && !isNaN(v)) { sum += v; cnt++; }
      }
      if (cnt < 2) return NaN;
      var mean = sum / cnt;
      var sq = 0;
      for (var i = start; i < arr.length; i++) {
        var v = arr[i][key];
        if (typeof v === 'number' && !isNaN(v)) sq += (v - mean) * (v - mean);
      }
      return Math.sqrt(sq / (cnt - 1));
    }
  
    /**
     * Rotation 3x3 -> Quaternion [x,y,z,w]. Normiert.
     */
    function mat3ToQuat(R) {
      if (!R || R.length < 9) return null;
      var m00 = R[0], m01 = R[1], m02 = R[2];
      var m10 = R[3], m11 = R[4], m12 = R[5];
      var m20 = R[6], m21 = R[7], m22 = R[8];
      var tr = m00 + m11 + m22;
      var x, y, z, w;
      if (tr > 0) {
        var s = 0.5 / Math.sqrt(tr + 1);
        w = 0.25 / s;
        x = (m21 - m12) * s;
        y = (m02 - m20) * s;
        z = (m10 - m01) * s;
      } else if (m00 > m11 && m00 > m22) {
        var s = 2 * Math.sqrt(1 + m00 - m11 - m22);
        w = (m21 - m12) / s;
        x = 0.25 * s;
        y = (m01 + m10) / s;
        z = (m02 + m20) / s;
      } else if (m11 > m22) {
        var s = 2 * Math.sqrt(1 + m11 - m00 - m22);
        w = (m02 - m20) / s;
        x = (m01 + m10) / s;
        y = 0.25 * s;
        z = (m12 + m21) / s;
      } else {
        var s = 2 * Math.sqrt(1 + m22 - m00 - m11);
        w = (m10 - m01) / s;
        x = (m02 + m20) / s;
        y = (m12 + m21) / s;
        z = 0.25 * s;
      }
      var n = Math.sqrt(x * x + y * y + z * z + w * w) || 1;
      return [x / n, y / n, z / n, w / n];
    }
  
    /**
     * Quaternion [x,y,z,w] -> Rotation 3x3.
     */
    function quatToMat3(q) {
      if (!q || q.length < 4) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
      var x = q[0], y = q[1], z = q[2], w = q[3];
      return [
        1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
        2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
        2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)
      ];
    }
  
    /**
     * SLERP: q_state = slerp(q_state, q_meas, alpha).
     * Vorzeichen-Fix: dot < 0 -> q_meas = -q_meas (shortest path).
     */
    // function quatLowpass(qState, qMeas, alpha) {
    //   if (!qState || !qMeas || alpha <= 0) return qMeas ? qMeas.slice() : null;
    //   if (alpha >= 1) return qMeas.slice();
    //   var dot = qState[0] * qMeas[0] + qState[1] * qMeas[1] + qState[2] * qMeas[2] + qState[3] * qMeas[3];
    //   if (dot < 0) {
    //     qMeas = [-qMeas[0], -qMeas[1], -qMeas[2], -qMeas[3]];
    //     dot = -dot;
    //   }
    //   dot = Math.min(1, Math.max(-1, dot));
    //   var theta = Math.acos(dot);
    //   var st = Math.sin(theta);
    //   if (st < 1e-8) return qState.slice();
    //   var wa = Math.sin((1 - alpha) * theta) / st;
    //   var wb = Math.sin(alpha * theta) / st;
    //   return [
    //     wa * qState[0] + wb * qMeas[0],
    //     wa * qState[1] + wb * qMeas[1],
    //     wa * qState[2] + wb * qMeas[2],
    //     wa * qState[3] + wb * qMeas[3]
    //   ];
    // }
    function quatNormalize(q) {
      var n = Math.hypot(q[0], q[1], q[2], q[3]);
      if (!isFinite(n) || n < 1e-12) return [0, 0, 0, 1]; // identity in [x,y,z,w]
      return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
    }
    
    function quatLowpass(qState, qMeas, alpha) {
      if (!qState || !qMeas) return qMeas ? quatNormalize(qMeas.slice()) : null;
    
      alpha = Math.max(0, Math.min(1, alpha));
      if (alpha <= 0) return quatNormalize(qState.slice());
      if (alpha >= 1) return quatNormalize(qMeas.slice());
    
      // normalize inputs to keep math stable
      qState = quatNormalize(qState);
      qMeas  = quatNormalize(qMeas);
    
      var dot = qState[0] * qMeas[0] + qState[1] * qMeas[1] + qState[2] * qMeas[2] + qState[3] * qMeas[3];
    
      // shortest path
      if (dot < 0) {
        qMeas = [-qMeas[0], -qMeas[1], -qMeas[2], -qMeas[3]];
        dot = -dot;
      }
      dot = Math.min(1, Math.max(-1, dot));
    
      // if very close: nlerp is safer than slerp
      if (dot > 0.9995) {
        var out = [
          qState[0] + alpha * (qMeas[0] - qState[0]),
          qState[1] + alpha * (qMeas[1] - qState[1]),
          qState[2] + alpha * (qMeas[2] - qState[2]),
          qState[3] + alpha * (qMeas[3] - qState[3])
        ];
        return quatNormalize(out);
      }
    
      var theta = Math.acos(dot);
      var st = Math.sin(theta);
    
      var wa = Math.sin((1 - alpha) * theta) / st;
      var wb = Math.sin(alpha * theta) / st;
    
      return quatNormalize([
        wa * qState[0] + wb * qMeas[0],
        wa * qState[1] + wb * qMeas[1],
        wa * qState[2] + wb * qMeas[2],
        wa * qState[3] + wb * qMeas[3]
      ]);
    }
    
  
    function imageDataToGray(imageData, intoBuffer) {
      var d = imageData.data;
      var n = imageData.width * imageData.height;
      var out = intoBuffer && intoBuffer.length >= n ? intoBuffer : new Uint8Array(n);
      for (var i = 0, j = 0; i < d.length; i += 4, j++) out[j] = (d[i] + d[i + 1] + d[i + 2]) / 3;
      return out;
    }
  
    /**
     * Kalibrier-Abstand zwischen zwei Markern.
     * @param {Object} markerPoses - id -> { t }
     * @param {number|null} m1Id - Marker 1 ID (oder null fuer poseIds[0])
     * @param {number|null} m2Id - Marker 2 ID
     * @param {string} axisMode - 'x' | 'xy'
     * @param {string[]} poseIds - sortierte Marker-IDs
     */
    function getCalibDistance(markerPoses, m1Id, m2Id, axisMode, poseIds) {
      var calibId1 = (m1Id >= 0 && markerPoses[String(m1Id)]) ? m1Id : null;
      var calibId2 = (m2Id >= 0 && markerPoses[String(m2Id)]) ? m2Id : null;
      var id1 = calibId1 != null ? String(calibId1) : (poseIds[0] || null);
      var id2 = calibId2 != null ? String(calibId2) : (poseIds[1] || null);
      if (!id1 || !id2 || id1 === id2 || !markerPoses[id1] || !markerPoses[id2]) {
        return { dist12: null, dist12xy: null, distForScale: null };
      }
      var p1 = markerPoses[id1].t;
      var p2 = markerPoses[id2].t;
      var dx = p2[0] - p1[0], dy = p2[1] - p1[1], dz = p2[2] - p1[2];
      var dist12xy = (axisMode === 'x') ? Math.abs(dx) : Math.sqrt(dx * dx + dy * dy);
      var dist12 = Math.sqrt(dx * dx + dy * dy + dz * dz);
      var distForScale = (axisMode === 'xyz') ? dist12 : dist12xy;
      return { dist12: dist12, dist12xy: dist12xy, distForScale: distForScale };
    }
  
    function getScaleFactor(distMeasured, realDist) {
      if (distMeasured == null || distMeasured <= 0 || !(realDist > 0)) return 1;
      return realDist / distMeasured;
    }

    /**
     * Auto-Skalierung aus Lineal-LUT. Pruft sichtbare Marker gegen rulerLut.
     * Fuer jedes benachbarte Paar aus bekannter Lineal-Sequenz: realDist/dist -> Skalierungsbeitrag.
     * @param {Object} markerPoses - id -> { t }
     * @param {Object} rulerLut - { rulers: [{ name, ids, axis, distMm }] }
     * @returns {Object|null} { scaleFactor, usedRulers, message } oder null
     */
    function getAutoScaleFromRulers(markerPoses, rulerLut) {
      if (!markerPoses || !rulerLut || !rulerLut.rulers || rulerLut.rulers.length === 0) return null;
      var pairs = [];
      for (var r = 0; r < rulerLut.rulers.length; r++) {
        var rule = rulerLut.rulers[r];
        if (!rule.ids || rule.ids.length < 2 || !(rule.distMm > 0)) continue;
        for (var i = 0; i < rule.ids.length - 1; i++) {
          var id1 = String(rule.ids[i]);
          var id2 = String(rule.ids[i + 1]);
          if (!markerPoses[id1] || !markerPoses[id1].t || !markerPoses[id2] || !markerPoses[id2].t) continue;
          var p1 = markerPoses[id1].t;
          var p2 = markerPoses[id2].t;
          var dx = p2[0] - p1[0], dy = p2[1] - p1[1], dz = p2[2] - p1[2];
          var dist = (rule.axis === 'x') ? Math.abs(dx) : (rule.axis === 'xyz') ? Math.sqrt(dx * dx + dy * dy + dz * dz) : Math.sqrt(dx * dx + dy * dy);
          if (dist > 0.1) pairs.push({ scale: rule.distMm / dist, name: rule.name, ids: id1 + '-' + id2 });
        }
      }
      if (pairs.length === 0) return null;
      var sum = 0;
      for (var j = 0; j < pairs.length; j++) sum += pairs[j].scale;
      var scaleFactor = sum / pairs.length;
      var usedNames = [];
      for (var k = 0; k < pairs.length; k++) {
        if (usedNames.indexOf(pairs[k].name) < 0) usedNames.push(pairs[k].name);
      }
      return {
        scaleFactor: scaleFactor,
        usedRulers: usedNames,
        pairCount: pairs.length,
        message: 'Auto: ' + usedNames.join(', ') + ' (' + pairs.length + ' Paare)'
      };
    }
  
    /**
     * Skalierte History-Daten fuer Plot T. windowSize>0: Sliding-Window-Mittel.
     */
    function scaleHistoryT(history, scaleFactor, zScaleFactor, windowSize) {
      return history.map(function (r, i) {
        var avg = (windowSize > 0 && i >= windowSize - 1) ? slidingWindowAvg(history, ['tx','ty','tz'], i, windowSize) : null;
        var tx = ((avg ? avg.tx : r.tx) || 0) * scaleFactor;
        var ty = ((avg ? avg.ty : r.ty) || 0) * scaleFactor;
        var tz = ((avg ? avg.tz : r.tz) || 0) * scaleFactor * zScaleFactor;
        return { t: r.t, tx: tx, ty: ty, tz: tz };
      });
    }
  
    /**
     * History-Daten fuer Plot R. windowSize>0: Sliding-Window-Mittel.
     */
    function prepareHistoryR(history, windowSize) {
      return history.map(function (r, i) {
        var avg = (windowSize > 0 && i >= windowSize - 1) ? slidingWindowAvg(history, ['rx','ry','rz'], i, windowSize) : null;
        var rx = typeof (avg ? avg.rx : r.rx) === 'number' ? norm90(avg ? avg.rx : r.rx) : r.rx;
        var ry = typeof (avg ? avg.ry : r.ry) === 'number' ? norm90(avg ? avg.ry : r.ry) : r.ry;
        var rz = typeof (avg ? avg.rz : r.rz) === 'number' ? norm180(avg ? avg.rz : r.rz) : r.rz;
        return { t: r.t, rx: rx, ry: ry, rz: rz };
      });
    }
  
    /**
     * History-Daten fuer Histogramm. windowSize>0: Sliding-Window-Mittel.
     * Optional historyR, windowSizeR fuer getrennte R-Quelle (z.B. Quaternion-Overlay).
     */
    function prepareHistData(history, scaleFactor, zScaleFactor, windowSize, historyR, windowSizeR) {
      var sc = scaleFactor !== 1 ? scaleFactor : 1;
      var scZ = sc * zScaleFactor;
      var useRHistory = historyR && historyR.length > 0;
      return history.map(function (r, i) {
        var avgT = (windowSize > 0 && i >= windowSize - 1) ? slidingWindowAvg(history, ['tx','ty','tz'], i, windowSize) : null;
        var hr = useRHistory && i < historyR.length ? historyR[i] : r;
        var wr = useRHistory ? (windowSizeR || 0) : windowSize;
        var avgR = (wr > 0 && i >= wr - 1 && historyR) ? slidingWindowAvg(historyR, ['rx','ry','rz'], i, wr) : null;
        var tx = (avgT ? avgT.tx : r.tx) || 0;
        var ty = (avgT ? avgT.ty : r.ty) || 0;
        var tz = (avgT ? avgT.tz : r.tz) || 0;
        var rx = typeof (avgR ? avgR.rx : hr.rx) === 'number' ? norm90(avgR ? avgR.rx : hr.rx) : hr.rx;
        var ry = typeof (avgR ? avgR.ry : hr.ry) === 'number' ? norm90(avgR ? avgR.ry : hr.ry) : hr.ry;
        var rz = typeof (avgR ? avgR.rz : hr.rz) === 'number' ? norm180(avgR ? avgR.rz : hr.rz) : hr.rz;
        return { tx: tx * sc, ty: ty * sc, tz: tz * scZ, rx: rx, ry: ry, rz: rz };
      });
    }
  
    /**
     * Projektion 3D -> Bild (u,v).
     */
    function projectPoint(p, K) {
      if (!p || p[2] <= 2 || !K) return null;
      return { u: K.fx * p[0] / p[2] + K.cx, v: K.fy * p[1] / p[2] + K.cy };
    }
  
    /**
     * Projiziert die 4 Tag-Ecken aus pose.
     */
    function getProjectedTagCorners(pose, K, getTagSizeMm, mid) {
      if (!pose || !pose.t || !pose.R || pose.R.length < 9 || !K) return null;
      var R = pose.R;
      var tagMm = (typeof getTagSizeMm === 'function' && mid != null ? getTagSizeMm(mid) : 12) || 12;
      var half = tagMm / 2;
      var mv = function (M, x, y) {
        return [M[0] * x + M[1] * y, M[3] * x + M[4] * y, M[6] * x + M[7] * y];
      };
      var corners = [[-half, -half], [half, -half], [half, half], [-half, half]];
      var out = [];
      for (var i = 0; i < 4; i++) {
        var m = mv(R, corners[i][0], corners[i][1]);
        var p3d = [pose.t[0] + m[0], pose.t[1] + m[1], pose.t[2] + m[2]];
        var uv = projectPoint(p3d, K);
        if (!uv) return null;
        out.push(uv);
      }
      return out;
    }
  
    /**
     * Berechnet Achsen-Segmente fuer Overlay (projiziert).
     */
    function getAxisSegments(overlayPoses, K, getTagSizeMm) {
      if (!K) return [];
      var segments = [];
      var axisColors = ['#e05050', '#50e050', '#5050e0'];
      var mv = function (R, x, y) {
        return [R[0] * x + R[1] * y, R[3] * x + R[4] * y, R[6] * x + R[7] * y];
      };
      for (var mid in overlayPoses) {
        var pp = overlayPoses[mid];
        if (!pp || !pp.t || !pp.R || pp.R.length < 9) continue;
        var t = pp.t;
        var R = pp.R;
        var tagMm = (typeof getTagSizeMm === 'function' ? getTagSizeMm(mid) : 12) || 12;
        var half = tagMm / 2;
        var objLeftLower = [-half, -half];
        var m = mv(R, objLeftLower[0], objLeftLower[1]);
        var pos3d = [m[0] + t[0], m[1] + t[1], m[2] + t[2]];
        var p0 = projectPoint(pos3d, K);
        if (!p0) continue;
        var axisLen = tagMm;
        for (var ai = 0; ai < 3; ai++) {
          var ax = [R[ai], R[ai + 3], R[ai + 6]];
          var pEnd = [pos3d[0] + ax[0] * axisLen, pos3d[1] + ax[1] * axisLen, pos3d[2] + ax[2] * axisLen];
          var p1 = projectPoint(pEnd, K);
          if (p1) segments.push({ p0: p0, p1: p1, color: axisColors[ai] });
        }
      }
      return segments;
    }
  
    /**
     * Normiert Euler fuer Anzeige (rx +180 fuer 0=frontal).
     */
    function normEulerForDisplay(euler) {
      if (!euler) return {};
      var rx = typeof euler.rx === 'number' && !isNaN(euler.rx) ? norm90(norm180(euler.rx + 180)) : euler.rx;
      var ry = typeof euler.ry === 'number' && !isNaN(euler.ry) ? norm90(euler.ry) : euler.ry;
      var rz = typeof euler.rz === 'number' && !isNaN(euler.rz) ? norm180(euler.rz) : euler.rz;
      return { rx: rx, ry: ry, rz: rz };
    }
  
    /**
     * Baut History-Record aus aktueller Pose. rx,ry,rz = Display; rxRaw,ryRaw,rzRaw, R fuer Overlay.
     */
    function buildHistoryRecord(pose, euler) {
      var rxCand = euler.rx, ryCand = euler.ry, rzCand = euler.rz;
      var rxD = typeof rxCand === 'number' && !isNaN(rxCand) ? norm90(norm180(rxCand + 180)) : rxCand;
      var ryD = typeof ryCand === 'number' && !isNaN(ryCand) ? norm90(ryCand) : ryCand;
      var rzD = typeof rzCand === 'number' && !isNaN(rzCand) ? norm180(rzCand) : rzCand;
      return {
        tx: pose.t[0], ty: pose.t[1], tz: pose.t[2],
        rx: rxD, ry: ryD, rz: rzD,
        rxRaw: rxCand, ryRaw: ryCand, rzRaw: rzCand,
        R: pose.R && pose.R.length >= 9 ? pose.R.slice() : null
      };
    }
  
    /**
     * Mittel mehrerer R-Matrizen via Spaltenmittel + Gram-Schmidt. Keine Euler/Quaternion.
     */
    function averageRotationsColumnWise(Rs) {
      if (!Rs || Rs.length === 0) return null;
      if (Rs.length === 1) return Rs[0].slice();
      var n = Rs.length;
      var cx = [0, 0, 0], cy = [0, 0, 0], cz = [0, 0, 0];
      for (var i = 0; i < n; i++) {
        var R = Rs[i];
        if (!R || R.length < 9) continue;
        cx[0] += R[0]; cx[1] += R[3]; cx[2] += R[6];
        cy[0] += R[1]; cy[1] += R[4]; cy[2] += R[7];
        cz[0] += R[2]; cz[1] += R[5]; cz[2] += R[8];
      }
      var len = function (v) { return Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]) || 1; };
      var dot = function (a, b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; };
      var sub = function (a, s, b) { a[0] -= s*b[0]; a[1] -= s*b[1]; a[2] -= s*b[2]; };
      var z = cz; var nz = len(z); z[0]/=nz; z[1]/=nz; z[2]/=nz;
      sub(cy, dot(cy, z), z); var ny = len(cy); cy[0]/=ny; cy[1]/=ny; cy[2]/=ny;
      sub(cx, dot(cx, z), z); sub(cx, dot(cx, cy), cy); var nx = len(cx); cx[0]/=nx; cx[1]/=nx; cx[2]/=nx;
      var det = cx[0]*(cy[1]*z[2]-cy[2]*z[1]) - cx[1]*(cy[0]*z[2]-cy[2]*z[0]) + cx[2]*(cy[0]*z[1]-cy[1]*z[0]);
      if (det < 0) { cy[0]=-cy[0]; cy[1]=-cy[1]; cy[2]=-cy[2]; }
      return [cx[0], cy[0], z[0], cx[1], cy[1], z[1], cx[2], cy[2], z[2]];
    }
  
    /**
     * Sliding-Window-Mittelwert. keys: ['tx','ty','tz'] oder ['rx','ry','rz'] oder ['rxRaw','ryRaw','rzRaw'].
     * Winkel werden entpackt (unwrapAngle) damit 179 und -179 korrekt zu 180 mitteln.
     */
    function slidingWindowAvg(history, keys, index, windowSize) {
      if (!history || history.length < 1 || windowSize < 1 || index < 0) return null;
      var start = Math.max(0, index - windowSize + 1);
      var n = index - start + 1;
      if (n < 1) return null;
      var out = {};
      for (var k = 0; k < keys.length; k++) {
        var key = keys[k];
        var sum = 0;
        var ref = history[start][key];
        if (typeof ref !== 'number' || isNaN(ref)) ref = history[index][key];
        for (var i = start; i <= index; i++) {
          var v = history[i][key];
          if (typeof v !== 'number' || isNaN(v)) v = ref;
          if (key === 'rx' || key === 'ry' || key === 'rxRaw' || key === 'ryRaw') {
            v = unwrapAngle90(v, ref);
          } else if (key === 'rz' || key === 'rzRaw') {
            v = unwrapAngle(v, ref);
          }
          sum += v;
        }
        out[key] = sum / n;
      }
      return out;
    }
  
    /**
     * Overlay-Posen: t = Fenster-Mittel. R = Quaternion-SLERP-Lowpass wenn opts.
     * opts: { quatStateByMarker, dt (s), fc (Hz, default 1.0), qualityWeight (0..1, optional) }
     */
    function buildOverlayPoses(historyByMarker, markerPoses, winSize, opts) {
      var overlayPoses = {};
      var useQuat = opts && opts.quatStateByMarker != null && typeof opts.dt === 'number' && opts.dt > 0;
      var fc = (opts && opts.fc > 0) ? opts.fc : 1.0;
      var quatState = opts && opts.quatStateByMarker ? opts.quatStateByMarker : null;
      for (var mid in markerPoses) {
        var pp = markerPoses[mid];
        if (!pp || !pp.t || !pp.R || pp.R.length < 9) continue;
        var R_out = pp.R;
        var t_out = pp.t;
        var history = historyByMarker && historyByMarker[mid];
        if (winSize > 0 && history && history.length >= 1) {
          var lastIdx = history.length - 1;
          var avgT = slidingWindowAvg(history, ['tx', 'ty', 'tz'], lastIdx, winSize);
          if (avgT) t_out = [avgT.tx, avgT.ty, avgT.tz];
        }
        if (useQuat) {
          var qMeas = mat3ToQuat(pp.R);
          if (qMeas && quatState) {
            var alpha = 1 - Math.exp(-2 * Math.PI * fc * opts.dt);
            if (opts.qualityWeight != null) alpha *= Math.max(0, Math.min(1, opts.qualityWeight));
            var qPrev = quatState[mid];
            if (!qPrev || !qPrev.length) {
              quatState[mid] = qMeas.slice();
            } else {
              quatState[mid] = quatLowpass(qPrev, qMeas, alpha);
            }
            R_out = quatToMat3(quatState[mid]);
          }
        }
        overlayPoses[mid] = { t: t_out, R: R_out };
      }
      if (quatState) {
        for (var id in quatState) { if (!markerPoses[id]) delete quatState[id]; }
      }
      return overlayPoses;
    }
  
    /**
     * Nicht mehr verwendet – ersetzt durch buildOverlayPoses (Sliding-Window).
     */
    function smoothOverlayPoses(markerPoses, markerAxisSmooth, smoothAlpha) {
      var overlayPoses = {};
      for (var mid in markerPoses) {
        var pp = markerPoses[mid];
        if (!pp || !pp.t || !pp.R || !pp.euler) continue;
        var prev = markerAxisSmooth[mid];
        var tNow = pp.t, eNow = pp.euler;
        var rx = eNow.rx, ry = eNow.ry, rz = eNow.rz;
        if (smoothAlpha > 0 && prev) {
          var tS = [
            smoothAlpha * tNow[0] + (1 - smoothAlpha) * prev.t[0],
            smoothAlpha * tNow[1] + (1 - smoothAlpha) * prev.t[1],
            smoothAlpha * tNow[2] + (1 - smoothAlpha) * prev.t[2]
          ];
          var rxU = unwrapAngle(rx, prev.rx);
          var ryU = unwrapAngle(ry, prev.ry);
          var rzU = unwrapAngle(rz, prev.rz);
          var rxS = smoothAlpha * rxU + (1 - smoothAlpha) * prev.rx;
          var ryS = smoothAlpha * ryU + (1 - smoothAlpha) * prev.ry;
          var rzS = smoothAlpha * rzU + (1 - smoothAlpha) * prev.rz;
          markerAxisSmooth[mid] = { t: tS, rx: rxS, ry: ryS, rz: rzS };
          overlayPoses[mid] = { t: tS, R: eulerToMat3(rxS, ryS, rzS) };
        } else {
          markerAxisSmooth[mid] = { t: tNow.slice(), rx: rx, ry: ry, rz: rz };
          overlayPoses[mid] = { t: tNow, R: pp.R };
        }
      }
      for (var mid in markerAxisSmooth) {
        if (!markerPoses[mid]) delete markerAxisSmooth[mid];
      }
      return overlayPoses;
    }
  
    /**
     * Berechnet Z-Kalibrier-Faktor: zScaleFactor = soll / tzRaw
     */
    function calcZScaleFactor(soll, tzRaw) {
      if (!isFinite(soll) || soll <= 0 || tzRaw == null || tzRaw <= 0) return null;
      return soll / tzRaw;
    }
  
    /**
     * Histogramm-Bins und Counts fuer ein Array von Werten.
     */
    function computeHistogramBins(vals, bins, vMin, vMax) {
      if (!vals || vals.length < 2) return null;
      var step = (vMax - vMin) < 1e-9 ? 1 : (vMax - vMin) / bins;
      var counts = new Array(bins).fill(0);
      for (var j = 0; j < vals.length; j++) {
        var vv = vals[j];
        var idx = Math.min(Math.max(0, Math.floor((vv - vMin) / (step || 1))), bins - 1);
        if (idx >= 0 && idx < bins) counts[idx]++;
      }
      return { counts: counts, step: step, maxCount: Math.max.apply(null, counts) || 1 };
    }
  
    /**
     * Plot-Bereich (min, max) aus Daten.
     */
    function computePlotRange(data, keys, tStart, tEnd, keyRanges) {
      var min = Infinity, max = -Infinity;
      if (!keyRanges) {
        for (var i = 0; i < data.length; i++) {
          if (data[i].t < tStart) continue;
          for (var k = 0; k < keys.length; k++) {
            var v = data[i][keys[k]];
            if (typeof v === 'number' && !isNaN(v)) {
              if (v < min) min = v;
              if (v > max) max = v;
            }
          }
        }
        if (min === Infinity) min = 0;
        if (max === min) max = min + 1;
        var margin = (max - min) * 0.1 || 1;
        min -= margin;
        max += margin;
      } else {
        var lo = Infinity, hi = -Infinity;
        for (var ki = 0; ki < keys.length; ki++) {
          var kr = keyRanges[keys[ki]];
          if (kr && kr.length >= 2) { lo = Math.min(lo, kr[0]); hi = Math.max(hi, kr[1]); }
        }
        if (lo !== Infinity) { min = lo; max = hi; }
      }
      return { min: min, max: max, range: max - min };
    }
  
    /**
     * Konvertiert Datenreihe zu Plot-Koordinaten (x,y in 0..1).
     * Returns: { series: { key: [{x,y}, ...] }, min, max, range }
     */
    function preparePlotSeries(data, keys, tStart, spanSec, rangeResult) {
      var min = rangeResult.min, max = rangeResult.max, range = rangeResult.range;
      var series = {};
      for (var ki = 0; ki < keys.length; ki++) {
        var key = keys[ki];
        series[key] = [];
        for (var j = 0; j < data.length; j++) {
          var pt = data[j];
          if (pt.t < tStart) continue;
          var x = (pt.t - tStart) / (spanSec * 1000);
          var v = pt[key];
          var y = 1 - ((typeof v === 'number' && !isNaN(v) ? v : min) - min) / (range || 1);
          series[key].push({ x: x, y: y });
        }
      }
      return { series: series, min: min, max: max, range: range };
    }
  
    global.DebugPoseEngine = {
      rotToEulerDeg: rotToEulerDeg,
      eulerToMat3: eulerToMat3,
      unwrapAngle: unwrapAngle,
      norm180: norm180,
      norm90: norm90,
      computeStd: computeStd,
      imageDataToGray: imageDataToGray,
      getCalibDistance: getCalibDistance,
      getScaleFactor: getScaleFactor,
      getAutoScaleFromRulers: getAutoScaleFromRulers,
      scaleHistoryT: scaleHistoryT,
      prepareHistoryR: prepareHistoryR,
      prepareHistData: prepareHistData,
      projectPoint: projectPoint,
      getProjectedTagCorners: getProjectedTagCorners,
      getAxisSegments: getAxisSegments,
      normEulerForDisplay: normEulerForDisplay,
      buildHistoryRecord: buildHistoryRecord,
      slidingWindowAvg: slidingWindowAvg,
      buildOverlayPoses: buildOverlayPoses,
      smoothOverlayPoses: smoothOverlayPoses,
      calcZScaleFactor: calcZScaleFactor,
      computeHistogramBins: computeHistogramBins,
      computePlotRange: computePlotRange,
      preparePlotSeries: preparePlotSeries
    };
  })(typeof window !== 'undefined' ? window : this);
  
/**
 * KISS-3D state: LUT, world model, state machine, pose update, LOCKED.
 * Requires KISS3DPose (kiss3d-pose.js) for pose from corners.
 * Plan: Plan-KISS-3D-Makro.md
 */
(function (global) {
  'use strict';

  var LUT = {
    ranges: [
      { idMin: 100, idMax: 199, tagMm: 6 },
      { idMin: 200, idMax: 299, tagMm: 12 },
      { idMin: 300, idMax: 399, tagMm: 20 }
    ],
    specialMin: 400,
    specialMax: 586
  };

  function getTagSizeMm(id) {
    var n = Number(id);
    if (n < 100) return null;
    for (var i = 0; i < LUT.ranges.length; i++) {
      var r = LUT.ranges[i];
      if (n >= r.idMin && n <= r.idMax) return r.tagMm;
    }
    if (n >= LUT.specialMin && n <= LUT.specialMax) return null;
    return null;
  }

  var STATE_IDLE = 'IDLE';
  var STATE_CAPTURE = 'CAPTURE';
  var STATE_LOCKED = 'LOCKED';

  var world = {
    ref_id: null,
    state: STATE_IDLE,
    markers: {}
  };

  var camera = null;
  var R_world_cam = null;
  var t_world_cam = null;
  var SMOOTH_ALPHA = 0.2;
  var LOCKED_MIN_CONFIDENCE = 10;
  var smoothCameraRotation = false;
  var smoothRotationJustEnabled = false;
  var lastUpdateTime = null;
  var smoothWindow = 3;
  var rFilterFc = 1;
  var lastTBuffer = [];
  var quatStateByMarker = {};
  /** Abbildungs-Korrektur: berechnet * scaleCorrection = real (z.B. 200 mm berechnet = 206 mm real -> 206/200). */
  var scaleCorrection = 206 / 200;

  function setSmoothWindow(w) {
    if (typeof w === 'number' && w >= 0 && w <= 200) {
      smoothWindow = Math.round(w);
      if (lastTBuffer.length > smoothWindow) lastTBuffer = lastTBuffer.slice(-smoothWindow);
    }
  }

  function getSmoothWindow() { return smoothWindow; }

  function setRFilterFc(fc) {
    if (typeof fc === 'number' && fc >= 0 && fc <= 10) rFilterFc = fc;
  }

  function getRFilterFc() { return rFilterFc; }

  function setSmoothCameraRotation(enabled) {
    var on = !!enabled;
    if (on && !smoothCameraRotation) smoothRotationJustEnabled = true;
    smoothCameraRotation = on;
  }

  function getScaleCorrection() {
    return scaleCorrection;
  }

  function setScaleCorrection(s) {
    if (typeof s === 'number' && s > 0) scaleCorrection = s;
  }

  function getSmoothAlpha() {
    return SMOOTH_ALPHA;
  }

  function setSmoothAlpha(a) {
    if (typeof a === 'number' && a >= 0.001 && a <= 0.99) SMOOTH_ALPHA = a;
  }

  function setCamera(K) {
    camera = K && K.fx && K.fy != null ? K : null;
  }

  function setCameraFromImage(imageWidth, imageHeight) {
    if (global.KISS3DPose && global.KISS3DPose.defaultCamera) {
      camera = KISS3DPose.defaultCamera(imageWidth, imageHeight);
    } else {
      camera = null;
    }
  }

  function reset() {
    world.ref_id = null;
    world.state = STATE_IDLE;
    world.markers = {};
    R_world_cam = null;
    t_world_cam = null;
    lastUpdateTime = null;
    lastTBuffer = [];
    quatStateByMarker = {};
  }

  /** Nach Reset: explizit wieder aufnehmen, damit IDLE erhalten bleibt bis User startet. */
  function startCapture() {
    if (world.state === STATE_IDLE) {
      world.state = STATE_CAPTURE;
    }
  }

  function mat3Transpose(R) {
    return [
      R[0], R[3], R[6],
      R[1], R[4], R[7],
      R[2], R[5], R[8]
    ];
  }

  /** R 3x3 row-major -> quaternion [x,y,z,w]. */
  function mat3ToQuat(R) {
    var t = R[0] + R[4] + R[8];
    var x, y, z, w;
    if (t > 0) {
      var s = 0.5 / Math.sqrt(t + 1);
      w = 0.25 / s;
      x = (R[5] - R[7]) * s;
      y = (R[6] - R[2]) * s;
      z = (R[1] - R[3]) * s;
    } else if (R[0] > R[4] && R[0] > R[8]) {
      var s = 2 * Math.sqrt(1 + R[0] - R[4] - R[8]);
      w = (R[5] - R[7]) / s;
      x = 0.25 * s;
      y = (R[3] + R[1]) / s;
      z = (R[6] + R[2]) / s;
    } else if (R[4] > R[8]) {
      var s = 2 * Math.sqrt(1 + R[4] - R[0] - R[8]);
      w = (R[6] - R[2]) / s;
      x = (R[3] + R[1]) / s;
      y = 0.25 * s;
      z = (R[7] + R[5]) / s;
    } else {
      var s = 2 * Math.sqrt(1 + R[8] - R[0] - R[4]);
      w = (R[1] - R[3]) / s;
      x = (R[6] + R[2]) / s;
      y = (R[7] + R[5]) / s;
      z = 0.25 * s;
    }
    return [x, y, z, w];
  }

  /** quat [x,y,z,w] -> R 3x3 row-major. */
  function quatToMat3(q) {
    var x = q[0], y = q[1], z = q[2], w = q[3];
    var x2 = x * x, y2 = y * y, z2 = z * z;
    return [
      1 - 2 * (y2 + z2), 2 * (x * y - z * w), 2 * (x * z + y * w),
      2 * (x * y + z * w), 1 - 2 * (x2 + z2), 2 * (y * z - x * w),
      2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x2 + y2)
    ];
  }

  /** Average quaternions (linear blend then normalize). qs = array of [x,y,z,w]. */
  function quatAverage(qs) {
    if (!qs || qs.length === 0) return null;
    var x = 0, y = 0, z = 0, w = 0;
    for (var i = 0; i < qs.length; i++) {
      var q = qs[i];
      var flip = (i > 0 && q[0] * qs[0][0] + q[1] * qs[0][1] + q[2] * qs[0][2] + q[3] * qs[0][3] < 0) ? -1 : 1;
      x += flip * q[0]; y += flip * q[1]; z += flip * q[2]; w += flip * q[3];
    }
    var n = Math.sqrt(x * x + y * y + z * z + w * w);
    if (n < 1e-10) return null;
    return [x / n, y / n, z / n, w / n];
  }

  /** One-pole quat lowpass: result = slerp(qState, qMeas, alpha). Alpha 0=keep state, 1=raw meas. */
  function quatLowpass(qState, qMeas, alpha) {
    if (!qState || !qMeas) return qMeas ? qMeas.slice() : null;
    alpha = Math.max(0, Math.min(1, alpha));
    if (alpha <= 0) return qState.slice();
    if (alpha >= 1) return qMeas.slice();
    return quatSlerp(qState, qMeas, alpha);
  }

  /** Slerp: t in [0,1], result toward qb. */
  function quatSlerp(qa, qb, t) {
    var ax = qa[0], ay = qa[1], az = qa[2], aw = qa[3];
    var bx = qb[0], by = qb[1], bz = qb[2], bw = qb[3];
    var dot = ax * bx + ay * by + az * bz + aw * bw;
    if (dot < 0) { bx = -bx; by = -by; bz = -bz; bw = -bw; dot = -dot; }
    if (dot > 0.9995) {
      var omt = 1 - t;
      return [omt * ax + t * bx, omt * ay + t * by, omt * az + t * bz, omt * aw + t * bw];
    }
    var th0 = Math.acos(dot);
    var th = th0 * t;
    var sinTh = Math.sin(th);
    var sinTh0 = Math.sin(th0);
    var s0 = Math.cos(th) - dot * sinTh / sinTh0;
    var s1 = sinTh / sinTh0;
    return [s0 * ax + s1 * bx, s0 * ay + s1 * by, s0 * az + s1 * bz, s0 * aw + s1 * bw];
  }

  /** A, B 3x3 row-major (9 elements). Return A*B row-major. */
  function mat3Mul(A, B) {
    return [
      A[0] * B[0] + A[1] * B[3] + A[2] * B[6],
      A[0] * B[1] + A[1] * B[4] + A[2] * B[7],
      A[0] * B[2] + A[1] * B[5] + A[2] * B[8],
      A[3] * B[0] + A[4] * B[3] + A[5] * B[6],
      A[3] * B[1] + A[4] * B[4] + A[5] * B[7],
      A[3] * B[2] + A[4] * B[5] + A[5] * B[8],
      A[6] * B[0] + A[7] * B[3] + A[8] * B[6],
      A[6] * B[1] + A[7] * B[4] + A[8] * B[7],
      A[6] * B[2] + A[7] * B[5] + A[8] * B[8]
    ];
  }

  function mat3MulVec(R, v) {
    return [
      R[0] * v[0] + R[1] * v[1] + R[2] * v[2],
      R[3] * v[0] + R[4] * v[1] + R[5] * v[2],
      R[6] * v[0] + R[7] * v[1] + R[8] * v[2]
    ];
  }

  function toWorld(posCam) {
    if (!R_world_cam || !t_world_cam) return null;
    var p = mat3MulVec(R_world_cam, posCam);
    return [p[0] + t_world_cam[0], p[1] + t_world_cam[1], p[2] + t_world_cam[2]];
  }

  function getState() {
    return world.state;
  }

  function getWorld() {
    return world;
  }

  /** Kamera-Position im Weltkoordinatensystem (Ref = Ursprung), fuer 3D-Darstellung. */
  function getCameraPositionInWorld() {
    if (!t_world_cam) return null;
    return [t_world_cam[0], t_world_cam[1], t_world_cam[2]];
  }

  /** Kamera-Rotation R_world_cam (3x3 row-major, 9 Elemente): Welt = R_world_cam * Kamera. Fuer kamerazentrische 3D-Ansicht. */
  function getCameraRotationInWorld() {
    if (!R_world_cam) return null;
    return R_world_cam.slice(0);
  }

  /**
   * Update world from current detections. markers: array of { id, corners }.
   * In IDLE nichts aendern (Reset bleibt sichtbar bis Start capture).
   */
  function updateFromDetections(markers, now) {
    if (world.state === STATE_IDLE) return;
    if (!markers || markers.length === 0) return;

    for (var j = 0; j < markers.length; j++) {
      var m = markers[j];
      var id = m.id;
      if (!world.markers[id]) {
        world.markers[id] = { pos: [0, 0, 0], rot: null, confidence: 0, last_seen: 0 };
      }
      var rec = world.markers[id];
      rec.confidence += 1;
      rec.last_seen = now;
    }

    var allIds = Object.keys(world.markers);
    if (allIds.length === 0) return;
    var minId = allIds[0];
    for (var k = 1; k < allIds.length; k++) {
      if (Number(allIds[k]) < Number(minId)) minId = allIds[k];
    }

    if (world.state === STATE_IDLE) {
      world.state = STATE_CAPTURE;
    }
    world.ref_id = minId;

    if (camera && global.KISS3DPose && global.KISS3DPose.poseFromCorners) {
      var poses = [];
      var detIds = [];
      for (var i = 0; i < markers.length; i++) {
        var det = markers[i];
        var tagMm = getTagSizeMm(det.id);
        if (tagMm == null) continue;
        var pose = KISS3DPose.poseFromCorners(det.corners, tagMm, camera);
        if (pose && pose.t) {
          poses.push(pose);
          detIds.push(det.id);
        }
      }
      if (poses.length > 0) {
        var dt = lastUpdateTime != null ? (now - lastUpdateTime) / 1000 : 1 / 30;
        lastUpdateTime = now;
        var alphaR = rFilterFc > 0 ? (1 - Math.exp(-2 * Math.PI * rFilterFc * dt)) : SMOOTH_ALPHA;
        alphaR = Math.max(0.001, Math.min(0.99, alphaR));
        var R_new;
        var t_new;
        var refIdStr = String(world.ref_id);
        var refPose = null;
        for (var k = 0; k < detIds.length; k++) {
          if (String(detIds[k]) === refIdStr) {
            refPose = poses[k];
            break;
          }
        }
        if (poses.length === 1) {
          var R_cam_ref = poses[0].R;
          R_new = mat3Transpose(R_cam_ref);
          var tt = poses[0].t;
          t_new = [
            -(R_new[0] * tt[0] + R_new[1] * tt[1] + R_new[2] * tt[2]),
            -(R_new[3] * tt[0] + R_new[4] * tt[1] + R_new[5] * tt[2]),
            -(R_new[6] * tt[0] + R_new[7] * tt[1] + R_new[8] * tt[2])
          ];
        } else {
          var quats = [];
          for (var k = 0; k < poses.length; k++) {
            var R_cam_m = poses[k].R;
            var R_world_cam_k = mat3Transpose(R_cam_m);
            quats.push(mat3ToQuat(R_world_cam_k));
          }
          var qAvg = quatAverage(quats);
          R_new = qAvg ? quatToMat3(qAvg) : mat3Transpose(poses[0].R);
          if (refPose && refPose.t) {
            var tt = refPose.t;
            t_new = [
              -(R_new[0] * tt[0] + R_new[1] * tt[1] + R_new[2] * tt[2]),
              -(R_new[3] * tt[0] + R_new[4] * tt[1] + R_new[5] * tt[2]),
              -(R_new[6] * tt[0] + R_new[7] * tt[1] + R_new[8] * tt[2])
            ];
          } else if (t_world_cam) {
            t_new = [t_world_cam[0], t_world_cam[1], t_world_cam[2]];
          } else {
            var tt = poses[0].t;
            t_new = [
              -(R_new[0] * tt[0] + R_new[1] * tt[1] + R_new[2] * tt[2]),
              -(R_new[3] * tt[0] + R_new[4] * tt[1] + R_new[5] * tt[2]),
              -(R_new[6] * tt[0] + R_new[7] * tt[1] + R_new[8] * tt[2])
            ];
          }
        }
        var t_use = t_new;
        if (smoothWindow > 0) {
          lastTBuffer.push([t_new[0], t_new[1], t_new[2]]);
          if (lastTBuffer.length > smoothWindow) lastTBuffer.shift();
          if (lastTBuffer.length >= 1) {
            var tx = 0, ty = 0, tz = 0;
            for (var bi = 0; bi < lastTBuffer.length; bi++) {
              tx += lastTBuffer[bi][0]; ty += lastTBuffer[bi][1]; tz += lastTBuffer[bi][2];
            }
            var n = lastTBuffer.length;
            t_use = [tx / n, ty / n, tz / n];
          }
        }
        var a = SMOOTH_ALPHA;
        if (t_world_cam) {
          t_world_cam[0] = a * t_use[0] + (1 - a) * t_world_cam[0];
          t_world_cam[1] = a * t_use[1] + (1 - a) * t_world_cam[1];
          t_world_cam[2] = a * t_use[2] + (1 - a) * t_world_cam[2];
        } else {
          t_world_cam = [t_use[0], t_use[1], t_use[2]];
        }
        if (smoothCameraRotation && R_world_cam && !smoothRotationJustEnabled) {
          var qOld = mat3ToQuat(R_world_cam);
          var qNew = mat3ToQuat(R_new);
          var q = quatSlerp(qOld, qNew, alphaR);
          R_world_cam = quatToMat3(q);
        } else {
          R_world_cam = R_new;
          if (smoothRotationJustEnabled) smoothRotationJustEnabled = false;
        }
      }
      if (R_world_cam && t_world_cam) {
        for (var j = 0; j < markers.length; j++) {
          var d = markers[j];
          var tagMm = getTagSizeMm(d.id);
          if (tagMm == null) continue;
          var pose = KISS3DPose.poseFromCorners(d.corners, tagMm, camera);
          if (!pose || !pose.t) continue;
          var posWorld = toWorld(pose.t);
          if (!posWorld) continue;
          var R_world_tag = mat3Mul(R_world_cam, pose.R);
          var rec = world.markers[d.id];
          var a = SMOOTH_ALPHA;
          rec.pos[0] = a * posWorld[0] + (1 - a) * rec.pos[0];
          rec.pos[1] = a * posWorld[1] + (1 - a) * rec.pos[1];
          rec.pos[2] = a * posWorld[2] + (1 - a) * rec.pos[2];
          if (rFilterFc > 0) {
            var qMeas = mat3ToQuat(R_world_tag);
            if (qMeas) {
              var qPrev = quatStateByMarker[d.id];
              var qSmooth = quatLowpass(qPrev, qMeas, alphaR);
              if (qSmooth) {
                quatStateByMarker[d.id] = qSmooth;
                rec.rot = quatToMat3(qSmooth);
              } else {
                rec.rot = R_world_tag;
              }
            } else {
              rec.rot = R_world_tag;
            }
          } else {
            rec.rot = R_world_tag;
          }
        }
        for (var mid in quatStateByMarker) { if (!world.markers[mid]) delete quatStateByMarker[mid]; }
      }
    }

    if (world.state === STATE_CAPTURE) {
      var all = world.markers;
      var canLock = true;
      for (var id in all) {
        if (all[id].confidence < LOCKED_MIN_CONFIDENCE) {
          canLock = false;
          break;
        }
      }
      if (canLock && allIds.length > 0) {
        world.state = STATE_LOCKED;
      }
    }
  }

  global.KISS3D = {
    getTagSizeMm: getTagSizeMm,
    STATE_IDLE: STATE_IDLE,
    STATE_CAPTURE: STATE_CAPTURE,
    STATE_LOCKED: STATE_LOCKED,
    setCamera: setCamera,
    setCameraFromImage: setCameraFromImage,
    getScaleCorrection: getScaleCorrection,
    setScaleCorrection: setScaleCorrection,
    getSmoothAlpha: getSmoothAlpha,
    setSmoothAlpha: setSmoothAlpha,
    reset: reset,
    startCapture: startCapture,
    getState: getState,
    getWorld: getWorld,
    getCameraPositionInWorld: getCameraPositionInWorld,
    getCameraRotationInWorld: getCameraRotationInWorld,
    setSmoothCameraRotation: setSmoothCameraRotation,
    setSmoothWindow: setSmoothWindow,
    getSmoothWindow: getSmoothWindow,
    setRFilterFc: setRFilterFc,
    getRFilterFc: getRFilterFc,
    updateFromDetections: updateFromDetections
  };
})(typeof window !== 'undefined' ? window : this);

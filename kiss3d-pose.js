/**
 * Minimal pose from 4 coplanar corners: homography (4-point DLT) then R,t from K.
 * Tag plane: z=0, corners at +/- (tagSize/2) in x,y. Output: tag center in camera frame (mm).
 * Plan: Plan-KISS-3D-Makro.md
 */
(function (global) {
  'use strict';

  /**
   * Solve 8x8 linear system Ax = b with Gaussian elimination (partial pivot).
   */
  function solve8(A, b) {
    var n = 8;
    var i, j, k, maxRow;
    var tmp, scale;
    for (k = 0; k < n; k++) {
      maxRow = k;
      for (i = k + 1; i < n; i++) {
        if (Math.abs(A[i][k]) > Math.abs(A[maxRow][k])) maxRow = i;
      }
      if (maxRow !== k) {
        for (j = 0; j < n; j++) { tmp = A[k][j]; A[k][j] = A[maxRow][j]; A[maxRow][j] = tmp; }
        tmp = b[k]; b[k] = b[maxRow]; b[maxRow] = tmp;
      }
      if (Math.abs(A[k][k]) < 1e-10) return null;
      scale = 1 / A[k][k];
      for (j = k; j < n; j++) A[k][j] *= scale;
      b[k] *= scale;
      for (i = 0; i < n; i++) {
        if (i === k) continue;
        scale = A[i][k];
        for (j = k; j < n; j++) A[i][j] -= scale * A[k][j];
        b[i] -= scale * b[k];
      }
    }
    return b;
  }

  /**
   * Homography from 4 object points (tag plane, mm) to 4 image points (pixels).
   * H: [u; v; 1] = H * [x; y; 1]. Returns 3x3 row-major or null.
   */
  function homography4(objPts, imgPts) {
    var i, row;
    var B = [];
    var c = [];
    for (i = 0; i < 4; i++) {
      var x = objPts[i][0], y = objPts[i][1];
      var u = imgPts[i][0], v = imgPts[i][1];
      B.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
      c.push(u);
      B.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
      c.push(v);
    }
    var h = solve8(B, c);
    if (!h) return null;
    return [
      [h[0], h[1], h[2]],
      [h[3], h[4], h[5]],
      [h[6], h[7], 1]
    ];
  }

  /**
   * From H and K get [r1 r2 t] = K^{-1}*H, then R = [r1 r2 r1×r2], t = translation.
   * K: { fx, fy, cx, cy }. Returns { R: 3x3 row-major, t: [tx,ty,tz] } in mm if object was in mm.
   */
  function decomposeHomography(H, K) {
    var fx = K.fx, fy = K.fy, cx = K.cx, cy = K.cy;
    var invK = [
      [1 / fx, 0, -cx / fx],
      [0, 1 / fy, -cy / fy],
      [0, 0, 1]
    ];
    var M = [
      [
        invK[0][0] * H[0][0] + invK[0][2] * H[2][0],
        invK[0][0] * H[0][1] + invK[0][2] * H[2][1],
        invK[0][0] * H[0][2] + invK[0][2] * H[2][2]
      ],
      [
        invK[1][1] * H[1][0] + invK[1][2] * H[2][0],
        invK[1][1] * H[1][1] + invK[1][2] * H[2][1],
        invK[1][1] * H[1][2] + invK[1][2] * H[2][2]
      ],
      [H[2][0], H[2][1], H[2][2]]
    ];
    var r1 = [M[0][0], M[1][0], M[2][0]];
    var r2 = [M[0][1], M[1][1], M[2][1]];
    var t = [M[0][2], M[1][2], M[2][2]];
    var n1 = Math.sqrt(r1[0] * r1[0] + r1[1] * r1[1] + r1[2] * r1[2]);
    var n2 = Math.sqrt(r2[0] * r2[0] + r2[1] * r2[1] + r2[2] * r2[2]);
    if (n1 < 1e-8 || n2 < 1e-8) return null;
    for (var i = 0; i < 3; i++) {
      r1[i] /= n1;
      r2[i] /= n2;
    }
    var scale = 2 / (n1 + n2);
    for (i = 0; i < 3; i++) t[i] *= scale;
    var r3 = [
      r1[1] * r2[2] - r1[2] * r2[1],
      r1[2] * r2[0] - r1[0] * r2[2],
      r1[0] * r2[1] - r1[1] * r2[0]
    ];
    var det = r1[0] * (r2[1] * r3[2] - r2[2] * r3[1]) - r1[1] * (r2[0] * r3[2] - r2[2] * r3[0]) + r1[2] * (r2[0] * r3[1] - r2[1] * r3[0]);
    if (det < 0) {
      r3[0] = -r3[0]; r3[1] = -r3[1]; r3[2] = -r3[2];
    }
    return {
      R: [r1[0], r2[0], r3[0], r1[1], r2[1], r3[1], r1[2], r2[2], r3[2]],
      t: t
    };
  }

  /**
   * Pose of tag in camera frame from 4 image corners and tag size (mm).
   * corners: array of 4 { x, y } in pixel order (same order as object points).
   * Object order: (-s/2,-s/2), (s/2,-s/2), (s/2,s/2), (-s/2,s/2) for tag size s.
   * K: { fx, fy, cx, cy }. Returns { R, t } or null.
   */
  function poseFromCorners(corners, tagSizeMm, K) {
    if (!corners || corners.length !== 4 || tagSizeMm <= 0 || !K) return null;
    var s = tagSizeMm;
    var half = s / 2;
    var objPts = [[-half, -half], [half, -half], [half, half], [-half, half]];
    var imgPts = [];
    for (var i = 0; i < 4; i++) {
      imgPts.push([corners[i].x, corners[i].y]);
    }
    var H = homography4(objPts, imgPts);
    if (!H) return null;
    return decomposeHomography(H, K);
  }

  /**
   * Build default camera matrix from image size (pinhole; fx ~ width).
   */
  function defaultCamera(imageWidth, imageHeight) {
    var w = imageWidth;
    var h = imageHeight;
    var f = Math.max(w, h);
    return { fx: f, fy: f, cx: w / 2, cy: h / 2 };
  }

  global.KISS3DPose = {
    poseFromCorners: poseFromCorners,
    defaultCamera: defaultCamera
  };
})(typeof window !== 'undefined' ? window : this);

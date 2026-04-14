"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.polynomialRegressionTask = polynomialRegressionTask;
var distributions_1 = require("./distributions");
// ─── Gaussian Elimination ────────────────────────────────────────────────────
function solveMatrix(A, B) {
    var n = A.length;
    var M = A.map(function (row, i) { return __spreadArray(__spreadArray([], row, true), [B[i]], false); });
    for (var i = 0; i < n; i++) {
        var maxEl = Math.abs(M[i][i]);
        var maxRow = i;
        for (var k = i + 1; k < n; k++) {
            if (Math.abs(M[k][i]) > maxEl) {
                maxEl = Math.abs(M[k][i]);
                maxRow = k;
            }
        }
        for (var k = i; k < n + 1; k++) {
            var tmp = M[maxRow][k];
            M[maxRow][k] = M[i][k];
            M[i][k] = tmp;
        }
        for (var k = i + 1; k < n; k++) {
            if (M[i][i] === 0)
                continue;
            var c = -M[k][i] / M[i][i];
            for (var j = i; j < n + 1; j++) {
                M[k][j] = i === j ? 0 : M[k][j] + c * M[i][j];
            }
        }
    }
    var x = new Array(n).fill(0);
    for (var i = n - 1; i >= 0; i--) {
        if (M[i][i] === 0) {
            x[i] = 0;
            continue;
        }
        x[i] = M[i][n] / M[i][i];
        for (var k = i - 1; k >= 0; k--)
            M[k][n] -= M[k][i] * x[i];
    }
    return x;
}
// ─── Equation Formatter ──────────────────────────────────────────────────────
function fmt(v) {
    if (v === 0)
        return '0';
    if (Math.abs(v) >= 0.001 && Math.abs(v) < 100000)
        return Number.isInteger(v) ? v.toString() : v.toFixed(4);
    return v.toExponential(4);
}
function formatEquation(coeffs) {
    if (coeffs.length === 0)
        return 'ŷ = 0';
    var eq = "\u0177 = ".concat(fmt(coeffs[0]));
    for (var i = 1; i < coeffs.length; i++) {
        var val = coeffs[i];
        var sign = val >= 0 ? ' + ' : ' - ';
        var term = i === 1 ? 'x' : "x\u00B2".replace('²', i === 2 ? '²' : "".concat(i));
        eq += "".concat(sign).concat(fmt(Math.abs(val))).concat(term);
    }
    return eq;
}
// ─── Main Regression Function (SISVAR-compatible) ───────────────────────────
/**
 * Receives raw individual observation pairs {x, y} for ONE qualitative level
 * (or the whole experiment if simple).
 *
 * Internally computes:
 *   - Pure Error SS / MSE  (within-dose replicates)
 *   - SS Treatments (between doses)
 *   - Sequential SS for each polynomial degree
 *   - Deviations from regression SS
 *
 * This exactly mirrors the SISVAR sequential polynomial regression approach.
 */
function polynomialRegressionTask(rawObs, variableName, factorName, maxDegree, levelName) {
    if (factorName === void 0) { factorName = null; }
    if (maxDegree === void 0) { maxDegree = 3; }
    if (rawObs.length < 3) {
        return {
            variableName: variableName,
            factorName: factorName,
            levelName: levelName,
            models: [], bestModelIndex: -1,
            xValues: [], observedMeans: [], mse: 0, dfError: 0, ssTreatments: 0, dfTreatments: 0
        };
    }
    // ── 1. Group by dose and compute means ─────────────────────────────────────
    var doseMap = new Map();
    for (var _i = 0, rawObs_1 = rawObs; _i < rawObs_1.length; _i++) {
        var _a = rawObs_1[_i], x = _a.x, y = _a.y;
        if (!doseMap.has(x))
            doseMap.set(x, []);
        doseMap.get(x).push(y);
    }
    var sortedDoses = Array.from(doseMap.keys()).sort(function (a, b) { return a - b; });
    var grandN = rawObs.length;
    var grandMean = rawObs.reduce(function (s, o) { return s + o.y; }, 0) / grandN;
    var k = sortedDoses.length; // number of doses
    // ── 2. SS Treatments (between doses) ───────────────────────────────────────
    var ssTreatments = 0;
    var doseMeans = [];
    for (var _b = 0, sortedDoses_1 = sortedDoses; _b < sortedDoses_1.length; _b++) {
        var x = sortedDoses_1[_b];
        var reps = doseMap.get(x);
        var mean = reps.reduce(function (s, v) { return s + v; }, 0) / reps.length;
        doseMeans.push(mean);
        ssTreatments += reps.length * Math.pow(mean - grandMean, 2);
    }
    var dfTreatments = k - 1;
    // ── 3. Pure Error SS / MSE (within-dose replicates) ────────────────────────
    var ssError = 0;
    var dfError = 0;
    for (var _c = 0, sortedDoses_2 = sortedDoses; _c < sortedDoses_2.length; _c++) {
        var x = sortedDoses_2[_c];
        var reps = doseMap.get(x);
        var mean = reps.reduce(function (s, v) { return s + v; }, 0) / reps.length;
        for (var _d = 0, reps_1 = reps; _d < reps_1.length; _d++) {
            var y = reps_1[_d];
            ssError += Math.pow(y - mean, 2);
        }
        dfError += reps.length - 1;
    }
    var mse = dfError > 0 ? ssError / dfError : 0;
    // ── 4. Build X and Y vectors (using raw obs for OLS) ────────────────────────
    // SISVAR fits the polynomial to the TREATMENT MEANS × n replications
    // (equivalent to fitting to all obs when each dose has equal reps).
    // We use dose means weighted by count, i.e. repeat the mean count times.
    var fitX = [];
    var fitY = [];
    for (var _e = 0, sortedDoses_3 = sortedDoses; _e < sortedDoses_3.length; _e++) {
        var x = sortedDoses_3[_e];
        var reps = doseMap.get(x);
        var mean = reps.reduce(function (s, v) { return s + v; }, 0) / reps.length;
        for (var i = 0; i < reps.length; i++) {
            fitX.push(x);
            fitY.push(mean);
        }
    }
    var fitN = fitX.length;
    var fitMean = fitY.reduce(function (s, v) { return s + v; }, 0) / fitN;
    // ── 5. Sequential polynomial models ─────────────────────────────────────────
    var models = [];
    var prevSSModel = 0;
    var maxD = Math.min(maxDegree, k - 1);
    var _loop_1 = function (d) {
        // Design matrix for degree d
        var X_d = fitX.map(function (xv) {
            var row = [];
            for (var j = 0; j <= d; j++)
                row.push(Math.pow(xv, j));
            return row;
        });
        // Normal equations: (X'X) β = X'Y
        var XtX = Array.from({ length: d + 1 }, function () { return new Array(d + 1).fill(0); });
        var XtY = new Array(d + 1).fill(0);
        for (var i = 0; i < fitN; i++) {
            for (var j = 0; j <= d; j++) {
                for (var l = 0; l <= d; l++)
                    XtX[j][l] += X_d[i][j] * X_d[i][l];
                XtY[j] += X_d[i][j] * fitY[i];
            }
        }
        var coeffs = void 0;
        try {
            coeffs = solveMatrix(XtX, XtY);
        }
        catch (_f) {
            return "break";
        }
        // SS Model (cumulative) for degree d
        var ssModel = 0;
        for (var i = 0; i < fitN; i++) {
            var yhat = 0;
            for (var j = 0; j <= d; j++)
                yhat += coeffs[j] * X_d[i][j];
            ssModel += Math.pow(yhat - fitMean, 2);
        }
        // Sequential SS = increase from adding this degree
        var ssSeq = ssModel - prevSSModel;
        if (ssSeq < 0 && ssSeq > -1e-10)
            ssSeq = 0;
        var msSeq = ssSeq / 1;
        var fSeq = mse > 0 ? msSeq / mse : 0;
        var pSeq = fSeq > 0 ? (0, distributions_1.fPValue)(fSeq, 1, dfError) : 1;
        // Deviations SS (lack-of-fit for this degree)
        var ssDev = ssTreatments - ssModel;
        if (ssDev < 0 && ssDev > -1e-10)
            ssDev = 0;
        var dfDev = dfTreatments - d;
        var msDev = dfDev > 0 ? ssDev / dfDev : 0;
        var fDev = mse > 0 ? msDev / mse : 0;
        var pDev = dfDev > 0 ? (0, distributions_1.fPValue)(fDev, dfDev, dfError) : 1;
        // R² relative to SS Treatments
        var r2 = ssTreatments > 0 ? ssModel / ssTreatments : 0;
        // Optimal point for quadratic
        var optPoint = null;
        var optType = null;
        if (d === 2 && coeffs[2] !== 0) {
            optPoint = -coeffs[1] / (2 * coeffs[2]);
            optType = coeffs[2] > 0 ? 'minimum' : 'maximum';
        }
        var degreeNames = ['', 'Linear', 'Quadrática', 'Cúbica'];
        models.push({
            degree: d,
            name: degreeNames[d] || "Grau ".concat(d),
            equation: formatEquation(coeffs),
            r2: r2,
            coefficients: coeffs,
            optimalPoint: optPoint,
            optimumType: optType,
            ssModelTotal: ssModel,
            ssSequential: ssSeq,
            msSequential: msSeq,
            fSequential: fSeq,
            pSequential: pSeq,
            ssDeviations: ssDev,
            dfDeviations: dfDev,
            msDeviations: msDev,
            fDeviations: fDev,
            pDeviations: pDev,
        });
        prevSSModel = ssModel;
    };
    for (var d = 1; d <= maxD; d++) {
        var state_1 = _loop_1(d);
        if (state_1 === "break")
            break;
    }
    // ── 6. Best model selection (SISVAR criteria) ────────────────────────────────
    // Highest degree with significant sequential P (< 0.05).
    // Also deviations should NOT be significant (lack of fit acceptable).
    // If no model passes, fall back to the highest-degree model anyway for plotting.
    var bestModelIndex = -1;
    for (var i = models.length - 1; i >= 0; i--) {
        if (models[i].pSequential <= 0.05) {
            bestModelIndex = i;
            break;
        }
    }
    // Fallback: if nothing significant but we have models, use best R²
    if (bestModelIndex === -1 && models.length > 0) {
        var bestR2_1 = -1;
        models.forEach(function (m, idx) {
            if (m.r2 > bestR2_1) {
                bestR2_1 = m.r2;
                bestModelIndex = idx;
            }
        });
    }
    return {
        variableName: variableName,
        factorName: factorName,
        levelName: levelName,
        models: models,
        bestModelIndex: bestModelIndex,
        xValues: sortedDoses,
        observedMeans: doseMeans,
        mse: mse,
        dfError: dfError,
        ssTreatments: ssTreatments,
        dfTreatments: dfTreatments,
    };
}

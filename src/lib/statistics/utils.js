"use strict";
/**
 * Statistical utility functions
 */
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
exports.mean = mean;
exports.sum = sum;
exports.sumOfSquares = sumOfSquares;
exports.variance = variance;
exports.standardDeviation = standardDeviation;
exports.standardError = standardError;
exports.flattenMatrix = flattenMatrix;
exports.formatNumber = formatNumber;
exports.coefficientOfVariation = coefficientOfVariation;
exports.assignLetters = assignLetters;
function mean(values) {
    if (values.length === 0)
        return 0;
    return values.reduce(function (sum, v) { return sum + v; }, 0) / values.length;
}
function sum(values) {
    return values.reduce(function (s, v) { return s + v; }, 0);
}
function sumOfSquares(values) {
    var m = mean(values);
    return values.reduce(function (ss, v) { return ss + Math.pow((v - m), 2); }, 0);
}
function variance(values, ddof) {
    if (ddof === void 0) { ddof = 1; }
    if (values.length <= ddof)
        return 0;
    var m = mean(values);
    return values.reduce(function (ss, v) { return ss + Math.pow((v - m), 2); }, 0) / (values.length - ddof);
}
function standardDeviation(values, ddof) {
    if (ddof === void 0) { ddof = 1; }
    return Math.sqrt(variance(values, ddof));
}
function standardError(values, ddof) {
    if (ddof === void 0) { ddof = 1; }
    return standardDeviation(values, ddof) / Math.sqrt(values.length);
}
function flattenMatrix(matrix) {
    return matrix.reduce(function (flat, row) { return __spreadArray(__spreadArray([], flat, true), row, true); }, []);
}
function formatNumber(value, decimals) {
    if (decimals === void 0) { decimals = 4; }
    return value.toFixed(decimals);
}
function coefficientOfVariation(overallMean, mse) {
    if (overallMean === 0)
        return 0;
    return (Math.sqrt(mse) / overallMean) * 100;
}
/**
 * Assign significance letters to groups based on sorted means
 * and a boolean matrix of significant differences.
 */
function assignLetters(means, isSignificant) {
    var n = means.length;
    var sorted = __spreadArray([], means, true).sort(function (a, b) { return a.mean - b.mean; });
    var letters = Array.from({ length: n }, function () { return new Set(); });
    var currentLetter = 0;
    for (var i = 0; i < n; i++) {
        if (letters[sorted[i].index].size === 0) {
            var letter = String.fromCharCode(97 + currentLetter);
            letters[sorted[i].index].add(letter);
            for (var j = i + 1; j < n; j++) {
                if (!isSignificant(sorted[i].index, sorted[j].index)) {
                    letters[sorted[j].index].add(letter);
                }
            }
            currentLetter++;
        }
    }
    // Consolidate: check that each group is valid
    var result = Array(n).fill('');
    for (var i = 0; i < n; i++) {
        result[i] = Array.from(letters[i]).sort().join('');
    }
    return result;
}

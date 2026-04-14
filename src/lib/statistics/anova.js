"use strict";
/**
 * Analysis of Variance (ANOVA) implementations
 * - DIC: Delineamento Inteiramente Casualizado (Completely Randomized Design)
 * - DBC: Delineamento em Blocos Casualizados (Randomized Complete Block Design)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.anovaDIC = anovaDIC;
exports.anovaDBC = anovaDBC;
var utils_1 = require("./utils");
var distributions_1 = require("./distributions");
var assumptions_1 = require("./assumptions");
/**
 * Perform ANOVA for a Completely Randomized Design (DIC)
 * @param data Matrix [treatments][repetitions], null represents missing data
 * @param treatmentNames Names of treatments
 */
function anovaDIC(data, treatmentNames, alpha) {
    if (alpha === void 0) { alpha = 0.05; }
    var k = data.length; // number of treatments
    // Clean data into numeric format only, separating groups
    var cleanGroups = data.map(function (row) { return row.filter(function (v) { return v !== null; }); });
    var allValues = (0, utils_1.flattenMatrix)(cleanGroups);
    var N = allValues.length;
    var grandMean = (0, utils_1.mean)(allValues);
    // Correction factor
    var C = (Math.pow((0, utils_1.sum)(allValues), 2)) / N;
    // Total Sum of Squares
    var ssTotal = allValues.reduce(function (acc, v) { return acc + Math.pow(v, 2); }, 0) - C;
    // Treatment Sum of Squares
    var treatmentMeans = cleanGroups.map(function (row) { return (0, utils_1.mean)(row) || 0; });
    var treatmentCounts = cleanGroups.map(function (row) { return row.length; });
    var ssTreatment = 0;
    for (var i = 0; i < k; i++) {
        var ni = treatmentCounts[i];
        if (ni > 0) {
            ssTreatment += ni * Math.pow((treatmentMeans[i] - grandMean), 2);
        }
    }
    // Error Sum of Squares
    var ssError = ssTotal - ssTreatment;
    // Degrees of freedom
    var dfTotal = N - 1;
    var dfTreatment = k - 1;
    var dfError = dfTotal - dfTreatment;
    // Mean Squares
    var msTreatment = ssTreatment / dfTreatment;
    var msError = ssError / dfError;
    // F statistic
    var fValue = msTreatment / msError;
    var pValue = (0, distributions_1.fPValue)(fValue, dfTreatment, dfError);
    var fc05 = (0, distributions_1.fCritical)(0.05, dfTreatment, dfError);
    var fc01 = (0, distributions_1.fCritical)(0.01, dfTreatment, dfError);
    function getSignificance(p, alpha) {
        if (p === null)
            return 'ns';
        if (p <= alpha)
            return '*';
        return 'ns';
    }
    var significance = getSignificance(pValue, alpha);
    var cv = (0, utils_1.coefficientOfVariation)(grandMean, msError);
    // Compute Assumptions
    // 1. Homoscedasticity (Bartlett)
    var homoscedasticity = (0, assumptions_1.bartlettTest)(cleanGroups, alpha);
    // 2. Normality (Shapiro-Wilk) of Residuals
    // residual = Y_ij - Mean_i
    var residuals = [];
    for (var i = 0; i < k; i++) {
        for (var j = 0; j < cleanGroups[i].length; j++) {
            residuals.push(cleanGroups[i][j] - treatmentMeans[i]);
        }
    }
    var normality = (0, assumptions_1.shapiroWilk)(residuals, alpha);
    var table = [
        {
            source: 'Tratamentos',
            df: dfTreatment,
            ss: ssTreatment,
            ms: msTreatment,
            fValue: fValue,
            pValue: pValue,
            fCritical05: fc05,
            fCritical01: fc01,
            significance: significance,
        },
        {
            source: 'Resíduo',
            df: dfError,
            ss: ssError,
            ms: msError,
            fValue: null,
            pValue: null,
            fCritical05: null,
            fCritical01: null,
            significance: '',
        },
        {
            source: 'Total',
            df: dfTotal,
            ss: ssTotal,
            ms: 0,
            fValue: null,
            pValue: null,
            fCritical05: null,
            fCritical01: null,
            significance: '',
        },
    ];
    return {
        table: table,
        overallMean: grandMean,
        cv: cv,
        mse: msError,
        dfError: dfError,
        treatmentMeans: treatmentMeans,
        treatmentCounts: treatmentCounts,
        treatmentNames: treatmentNames,
        design: 'DIC',
        assumptions: {
            homoscedasticity: homoscedasticity,
            normality: normality
        }
    };
}
/**
 * Perform ANOVA for a Randomized Complete Block Design (DBC)
 * @param data Matrix [treatments][blocks] - each row is a treatment, each column is a block, null represents missing values
 * @param treatmentNames Names of treatments
 */
function anovaDBC(data, treatmentNames, alpha) {
    if (alpha === void 0) { alpha = 0.05; }
    var k = data.length; // number of treatments
    var b = data[0].length; // maximum number of blocks
    // Extract all valid values for general stats
    var cleanGroups = data.map(function (row) { return row.filter(function (v) { return v !== null; }); });
    var allValues = (0, utils_1.flattenMatrix)(cleanGroups);
    var N = allValues.length;
    var grandMean = (0, utils_1.mean)(allValues);
    // Correction factor
    var C = (Math.pow((0, utils_1.sum)(allValues), 2)) / N;
    // Total Sum of Squares
    var ssTotal = allValues.reduce(function (acc, v) { return acc + Math.pow(v, 2); }, 0) - C;
    // Treatment Sum of Squares (approximation for unbalanced, but assuming generally balanced DBC)
    var treatmentMeans = cleanGroups.map(function (row) { return (0, utils_1.mean)(row) || 0; });
    var treatmentCounts = cleanGroups.map(function (row) { return row.length; });
    var ssTreatment = 0;
    for (var i = 0; i < k; i++) {
        var ni = treatmentCounts[i];
        if (ni > 0) {
            ssTreatment += ni * Math.pow((treatmentMeans[i] - grandMean), 2);
        }
    }
    // Block Sum of Squares
    var ssBlock = 0;
    var _loop_1 = function (j) {
        var blockValues = data.map(function (row) { return row[j]; }).filter(function (v) { return v !== null; });
        if (blockValues.length > 0) {
            var blockMean = (0, utils_1.mean)(blockValues) || 0;
            ssBlock += blockValues.length * Math.pow((blockMean - grandMean), 2);
        }
    };
    for (var j = 0; j < b; j++) {
        _loop_1(j);
    }
    // Error Sum of Squares
    var ssError = ssTotal - ssTreatment - ssBlock;
    // Degrees of freedom
    var dfTotal = N - 1;
    var dfTreatment = k - 1;
    var dfBlock = b - 1;
    // Approximation for potentially unbalanced DBC: N - 1 - (k-1) - (b-1)
    var dfError = dfTotal - dfTreatment - dfBlock;
    // Mean Squares
    var msTreatment = ssTreatment / dfTreatment;
    var msBlock = ssBlock / dfBlock;
    var msError = ssError / dfError;
    // F statistics
    var fTreatment = msTreatment / msError;
    var pTreatment = (0, distributions_1.fPValue)(fTreatment, dfTreatment, dfError);
    var fcTreat05 = (0, distributions_1.fCritical)(0.05, dfTreatment, dfError);
    var fcTreat01 = (0, distributions_1.fCritical)(0.01, dfTreatment, dfError);
    var fBlock = msBlock / msError;
    var pBlock = (0, distributions_1.fPValue)(fBlock, dfBlock, dfError);
    var fcBlock05 = (0, distributions_1.fCritical)(0.05, dfBlock, dfError);
    var fcBlock01 = (0, distributions_1.fCritical)(0.01, dfBlock, dfError);
    function getSignificance(p, alpha) {
        if (p === null)
            return 'ns';
        if (p <= alpha)
            return '*';
        return 'ns';
    }
    var sigTreatment = getSignificance(pTreatment, alpha);
    var sigBlock = getSignificance(pBlock, alpha);
    var cv = (0, utils_1.coefficientOfVariation)(grandMean, msError);
    // Compute Assumptions
    // 1. Homoscedasticity (Bartlett)
    var homoscedasticity = (0, assumptions_1.bartlettTest)(cleanGroups, alpha);
    // 2. Normality (Shapiro-Wilk) of Residuals
    // residual = Y_ij - MeanTreat_i - MeanBlock_j + GrandMean (classical approximation)
    var residuals = [];
    for (var i = 0; i < k; i++) {
        var _loop_2 = function (j) {
            var val = data[i][j];
            if (val !== null) {
                var blockValues = data.map(function (row) { return row[j]; }).filter(function (v) { return v !== null; });
                var blockMean = (0, utils_1.mean)(blockValues) || grandMean;
                residuals.push(val - treatmentMeans[i] - blockMean + grandMean);
            }
        };
        for (var j = 0; j < b; j++) {
            _loop_2(j);
        }
    }
    var normality = (0, assumptions_1.shapiroWilk)(residuals, alpha);
    var table = [
        {
            source: 'Tratamentos',
            df: dfTreatment,
            ss: ssTreatment,
            ms: msTreatment,
            fValue: fTreatment,
            pValue: pTreatment,
            fCritical05: fcTreat05,
            fCritical01: fcTreat01,
            significance: sigTreatment,
        },
        {
            source: 'Blocos',
            df: dfBlock,
            ss: ssBlock,
            ms: msBlock,
            fValue: fBlock,
            pValue: pBlock,
            fCritical05: fcBlock05,
            fCritical01: fcBlock01,
            significance: sigBlock,
        },
        {
            source: 'Resíduo',
            df: dfError,
            ss: ssError,
            ms: msError,
            fValue: null,
            pValue: null,
            fCritical05: null,
            fCritical01: null,
            significance: '',
        },
        {
            source: 'Total',
            df: dfTotal,
            ss: ssTotal,
            ms: 0,
            fValue: null,
            pValue: null,
            fCritical05: null,
            fCritical01: null,
            significance: '',
        },
    ];
    return {
        table: table,
        overallMean: grandMean,
        cv: cv,
        mse: msError,
        dfError: dfError,
        treatmentMeans: treatmentMeans,
        treatmentCounts: treatmentCounts,
        treatmentNames: treatmentNames,
        design: 'DBC',
        assumptions: {
            homoscedasticity: homoscedasticity,
            normality: normality
        }
    };
}

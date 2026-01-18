/*
This script creates a single image containing one NDVI band per year for the requested period and SIDS.

The CCDC algorithm was applied only to pixels with more than one year gap in LS and L32 collections, 
producing four synthetic images just for NIR and red bands by year, instead 12, to reduce the processing cost. 
NDVI was calculated from each of those synthetic images.

Developed by Apacheta Team .- www.apacheta.org
License: This work is licensed under a Apache License Version 2.0
Please visit this link for more information: https://www.apache.org/licenses/LICENSE-2.0

*/
var ftcADM0BufferBounds = ee.FeatureCollection("projects/apacheta/assets/SIDS/SIDS_GAUL_1kmBuffferBounds_ADM0"),
    ftcADM0Buffer = ee.FeatureCollection("projects/apacheta/assets/SIDS/SIDS_GAUL_1kmBufffer_ADM0");

var createCompositeCCDC = function (startYear, endYear, countryName) {

    // Boundaries created from GAUL assets
    var ftcCountryBuffer = ftcADM0Buffer.filter(ee.Filter.eq('ADM0_NAME', countryName));
    var ftcCountryBufferBounds = ftcADM0BufferBounds.filter(ee.Filter.eq('ADM0_NAME', countryName));
    
    countryName = countryName.replace(/ /g, '_').replace('(', '_').replace(')', '_');

    // Load NDVI assets created from LANDSAT assets
    var stackL32 = ee.Image("projects/apacheta1/assets/NDVI/L32/NDVI_Landsat_32d_median_" + countryName + "_2000_2023_v1");
    var stackLS = ee.Image("projects/apacheta-geo-ldn/assets/NDVI/LS/NDVI_Landsat_5789_median_" + countryName + "_2000_2023_v1");

    var yearsPeriod = ee.List.sequence(startYear, endYear);

    var imcMixedCollection = ee.ImageCollection.fromImages(

        yearsPeriod.map(function (y) {

            var imgCurrentYearL32 = stackL32.select((ee.String('NDVI_').cat(ee.String(ee.Number(y).toInt())))).rename('L32_Median');
            var imgCurrentYearLS = stackLS.select((ee.String('NDVI_').cat(ee.String(ee.Number(y).toInt())))).rename('LS_Median');

            // If this is the first year of the series, previous=current
            var prevYear = ee.Algorithms.If(ee.Number(y).eq(yearsPeriod.get(0)), ee.Number(y).toInt(), ee.Number(y).subtract(1).toInt());
            // If this is the last year of the series, subsequent=current
            var subsYear = ee.Algorithms.If(ee.Number(y).eq(yearsPeriod.get(yearsPeriod.size().subtract(1))), ee.Number(y).toInt(), ee.Number(y).add(1).toInt());

            // Calculate mean from previous and subsequent years for L32
            var imgPreviousYearL32 = stackL32.select((ee.String('NDVI_').cat(ee.String(prevYear))));
            var imgSubsequentYearL32 = stackL32.select((ee.String('NDVI_').cat(ee.String(subsYear))));
            var imgMeanPreSubL32 = imgPreviousYearL32.add(imgSubsequentYearL32).divide(2).rename('L32_Pre_Sub_mean');

            // Calculate mean from previous and subsequent years for LS
            var imgPreviousYearLS = stackLS.select((ee.String('NDVI_').cat(ee.String(prevYear))));
            var imgSubsequentYearLS = stackLS.select((ee.String('NDVI_').cat(ee.String(subsYear))));
            var imgMeanPreSubLS = imgPreviousYearLS.add(imgSubsequentYearLS).divide(2).rename('LS_Pre_Sub_mean');

            // When value from L32 is masked, try to fill it with the mean from previous and subsequent years
            var imgFillGapYearL32 = imgCurrentYearL32.unmask(-32768).where(imgCurrentYearL32.unmask(-32768).eq(-32768), imgMeanPreSubL32)
                .rename('L32_fillGapYear');

            // When value from LS is masked, try to fill it with the mean from previous and subsequent years
            var imgFillGapYearLS = imgCurrentYearLS.unmask(-32768).where(imgCurrentYearLS.unmask(-32768).eq(-32768), imgMeanPreSubLS)
                .rename('LS_fillGapYear');

            // Calculate max value between LS and L32
            var imgMax = imgFillGapYearL32.max(imgFillGapYearLS).rename('NDVI');
            imgMax = imgMax.updateMask(imgMax.neq(-32768));

            // Add all the bands
            var finalImage = imgMax
                .set('year', y)
                .set('system:time_start', ee.Date.fromYMD(y, 1, 1).millis());

            return finalImage;
        }));

    var totalYears = endYear - startYear + 1; // 2000-2023 -> 24 years
    // Create an image with pixels with no value in imcMixedCollection 
    var imgCountNoValue = imcMixedCollection.count().neq(totalYears);

    var imgStackMaxMixed = imcMixedCollection.toBands();
    Map.addLayer(imgStackMaxMixed, {}, 'imgStackMaxMixed', false);
    Map.addLayer(imcMixedCollection.count().updateMask(imcMixedCollection.count().neq(totalYears)), { palette: 'pink', min: 1, max: totalYears }, 'Count 1-' + totalYears, false);

    ///////////////////////////////////////////////////////////
    ///////////////////LANDSAT 5///////////////////////////////
    ///////////////////////////////////////////////////////////

    // Function to mask clouds and clauds shadows
    function maskLandsat(image) {
        var qaBand = image.select('QA_PIXEL');
        var cloudShadowBitMask = 1 << 4; // Bit 4: Cloud Shadow
        var cloudBitMask = 1 << 3; // Bit 5: Cloud

        var mask = qaBand.bitwiseAnd(cloudShadowBitMask).eq(0)
            .and(qaBand.bitwiseAnd(cloudBitMask).eq(0));

        return image.updateMask(mask).copyProperties(image, ['system:time_start']);
    }

    // Function to add NDVI band
    function addNDVI(image) {
        var NDVI = image.normalizedDifference(['NIR', 'RED']).rename('NDVI').multiply(10000).toInt16();
        var NDSI = image.normalizedDifference(['GREEN', 'SWIR1']).rename('NDSI').lte(0.5);
        return image.addBands(NDVI).addBands(NDSI).mask(NDSI).copyProperties(image, ['system:time_start']);
    }

    // Function to apply scaling factors
    function applyScaleFactors(image) {
        var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2);
        return opticalBands.rename('GREEN', 'RED', 'NIR', 'SWIR1').mask(opticalBands.lte(1)).copyProperties(image, ['system:time_start']);
    }

    // Merge Landsat images into a new collection
    var imcLandsatMerged = ee.ImageCollection('LANDSAT/LT05/C02/T1_L2').select(['SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'QA_PIXEL'])
        .merge(ee.ImageCollection('LANDSAT/LE07/C02/T1_L2').select(['SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'QA_PIXEL']))
        .merge(ee.ImageCollection('LANDSAT/LC08/C02/T1_L2').select(['SR_B3', 'SR_B4', 'SR_B5', 'SR_B6', 'QA_PIXEL']))
        .merge(ee.ImageCollection('LANDSAT/LC09/C02/T1_L2').select(['SR_B3', 'SR_B4', 'SR_B5', 'SR_B6', 'QA_PIXEL']));

    // Apply filters
    var imcLandsatMergedFiltered = imcLandsatMerged
        .filterBounds(ftcCountryBuffer)
        .filterDate(startYear + '-01-01', endYear + '-12-31')
        .map(function (img) {// update mask to only pixels which have no values in max time series
            return img.updateMask(imgCountNoValue.eq(1)); // .eq(1) at least one year in the series with no value
        })
        .map(maskLandsat).map(applyScaleFactors).map(addNDVI);

    Map.addLayer(imcLandsatMergedFiltered.filterDate('2007-01-01', '2007-12-31'), {}, 'imcLandsatMergedFiltered', false);


    // Set CCD params to use.
    var ccdParams = {
        breakpointBands: ['NDVI', 'RED', 'NIR', 'GREEN', 'SWIR1'],
        tmaskBands: ['GREEN', 'SWIR1'],
        minObservations: 4,//The number of observations required to flag a change. Default: 6
        chiSquareProbability: 0.99,//The chi-square probability threshold for change detection in the range of [0, 1]. Default: 0.99
        minNumOfYearsScaler: 0.5,//Factors of minimum number of years to apply new fitting. Default: 1.33
        dateFormat: 1,
        lambda: 0.00,//Lambda for LASSO regression fitting. If set to 0, regular OLS is used instead of LASSO. Default: 0.002
        maxIterations: 10000,//Maximum number of runs for LASSO regression convergence. If set to 0, regular OLS is used instead of LASSO.
        collection: imcLandsatMergedFiltered
    };

    // Run CCD.
    var imgCCDCTemporalSegmentation = ee.Algorithms.TemporalSegmentation.Ccdc(ccdParams);


    // Load the API file
    var utils = require('users/parevalo_bu/gee-ccdc-tools:ccdcUtilities/api');

    // Create a list of 4 dates for each year
    function generateDates(startYear, endYear) {
        var years = ee.List.sequence(startYear, endYear);
        var dates = years.map(function (year) {
            return ee.List([2, 5, 8, 11]).map(function (month) {
                return ee.Date.fromYMD(year, month, 1).format('YYYY-MM-dd');
            });
        }).flatten();
        return dates;
    }

    var datesList = generateDates(startYear, endYear);
    // print('Dates:', datesList);

    // Function to convert a date to fractionary years
    var msToFrac = function (ms) {
        var year = ee.Date(ms).get('year');
        var frac = ee.Date(ms).getFraction('year');
        return year.add(frac);
    };

    // Apply the functio to each date in the list
    var fractionalYears = datesList.map(function (date) {
        return msToFrac(date);
    });

    // print('Dates in fractional years:', fractionalYears);

    // Create CCDC image for each date
    var listCCDCimages = fractionalYears.map(function (fractionalYear) {
        var actualDate = ee.Number(fractionalYear);

        // Spectral band names. This list contains all possible bands in this dataset
        var BANDS = ['RED', 'NIR'];

        // Names of the temporal segments
        var SEGS = ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10"];

        // Obtain CCDC results in 'regular' ee.Image format
        var imgCCDC = utils.CCDC.buildCcdImage(imgCCDCTemporalSegmentation, SEGS.length, BANDS);

        // Obtain synthetic image
        var imgSynt = utils.CCDC.getMultiSynthetic(imgCCDC, actualDate, 1, BANDS, SEGS);

        return imgSynt.set('fractionalYear', actualDate);
    });


    // Add NDVI band to image
    function addNDVISolo(image) {
        var NDVI = image.normalizedDifference(['NIR', 'RED']).rename('NDVI').multiply(10000).toInt16();
        return image.addBands(NDVI);
    }

    // Create image collection from list of images, keeping only the NDVI band
    var imcCCDC = ee.ImageCollection(listCCDCimages).map(addNDVISolo).select('NDVI');
    Map.addLayer(imcCCDC.select('NDVI'), { min: 5000, max: 8000 }, 'imcCCDC', false);

    // Add year as a property
    var NDVIcollWithYear = imcCCDC.map(function (image) {
        var year = ee.Number(image.get('fractionalYear')).floor(); // Obtener el año entero
        return image.set('year', year); // Agregarlo como propiedad
    });
    Map.addLayer(NDVIcollWithYear.select('NDVI'), { min: 5000, max: 8000 }, 'NDVIcollWithYear', false);



    var years = ee.List.sequence(startYear, endYear);
    // Group the images by year and calculate the mean
    var NDVIMeanByYear = years.map(function (year) {
        var yearImages = NDVIcollWithYear.filter(ee.Filter.eq('year', year));
        var meanImage = yearImages.mean().set('year', year);
        return meanImage;
    });

    // Create a new image collection
    var NDVIMeanCollection = ee.ImageCollection(NDVIMeanByYear);
    Map.addLayer(NDVIMeanCollection, { min: 7000, max: 9000 }, 'NDVI Mean Mosaic', false);

    // Function to rename the bands to NDVI_YYYY
    var renameBandsByYear = function (image) {
        var year = ee.Number(image.get('year')).format('%d');
        var renamedImage = image.rename(ee.String('NDVI_').cat(year));
        return renamedImage;
    };

    var renamedCollection = NDVIMeanCollection.map(renameBandsByYear);

    // Create a final image with one band per year
    var finalImage = renamedCollection.toBands();

    // Correct predefined prefixes when applying toBands()
    var bandNames = renamedCollection.aggregate_array('system:index')
        .map(function (index) {
            return ee.String('NDVI_').cat(ee.Number(ee.Image(NDVIMeanCollection.filter(ee.Filter.eq('system:index', index)).first()).get('year')).format('%d'));
        });
    finalImage = finalImage.rename(ee.List(bandNames));


    Map.addLayer(finalImage, {}, 'finalImage', false);

    // Center to selected country
    Map.centerObject(ftcCountryBuffer);

    var NDVILabel = 'NDVI_CCDC_ForGaps_' + countryName + '_' + startYear + '_' + endYear + '_v1';

    Export.image.toAsset({
        image: finalImage.clip(ftcCountryBuffer).toInt16(),
        description: 'Export_' + NDVILabel,
        assetId: 'projects/apacheta-geo-ldn/assets/NDVI/CCDC/' + NDVILabel,
        scale: 30,
        region: ftcCountryBufferBounds,
        maxPixels: 1e13,
        pyramidingPolicy: { '.default': 'mean' },
        crs: 'EPSG:4326'
    });

    return finalImage;
};

exports.createCompositeCCDC = createCompositeCCDC;

// Test this script
createCompositeCCDC(2000, 2023, 'Grenada');

// SIDS names
var listSIDS = [
    'Antigua and Barbuda',
    'Bahamas',
    'Bahrain',
    'Barbados',
    'Belize',
    'Cape Verde',
    'Comoros',
    'Cook Islands',
    'Cuba',
    'Dominica',
    'Dominican Republic',
    'Fiji',
    'Grenada',
    'Guinea-Bissau',
    'Guyana',
    'Haiti',
    'Jamaica',
    'Kiribati',
    'Maldives',
    'Marshall Islands',
    'Mauritius',
    'Micronesia (Federated States of)',
    'Nauru',
    'Niue',
    'Palau',
    'Papua New Guinea',
    'Saint Kitts and Nevis',
    'Saint Lucia',
    'Saint Vincent and the Grenadines',
    'Samoa',
    'Sao Tome and Principe',
    'Seychelles',
    'Singapore',
    'Solomon Islands',
    'Suriname',
    'Timor-Leste',
    'Tonga',
    'Trinidad and Tobago',
    'Tuvalu',
    'Vanuatu'
];


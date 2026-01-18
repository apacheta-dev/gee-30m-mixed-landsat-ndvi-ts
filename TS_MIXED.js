/*
This script creates a single image containing one NDVI band per year for the requested period and SIDS.

This Mixed time series of NDVI is entirely based on 30m Landsat images 
The whole process is based on three datasets: 
1- All Landsat (5, 7, 8 and 9) images availables for the period 2000-2023; 
2- Landsat 32-Day NDVI Composite and 
3- Synthetic images based on the first dataset for filling gaps. 

See TS_Landsat_578.js, TS_Landsat_32Day.js and TS_CCDC.js scripts in users/apacheta/Mixed_Landsat_NDVI_TS repository 
to check how these input NDVI datasets used here were created.

The three datasets were combined in a unique time series applying spatial and temporal filters for filling gaps 
and correcting cloud effects.

Steps involved in the creation of the Mixed TS:
Load TS 32day GapFillSpatial
Load TS LS578 GapFillSpatial
Gap filling 1 year gap with the mean from previous and subsequent years in both series
Max of both series 
Gap filling with CCDC
One drop correction

Developed by Apacheta Team .- www.apacheta.org
License: This work is licensed under a Apache License Version 2.0
Please visit this link for more information: https://www.apache.org/licenses/LICENSE-2.0

*/

var ftcADM0BufferBounds = ee.FeatureCollection("projects/apacheta/assets/SIDS/SIDS_GAUL_1kmBuffferBounds_ADM0"),
    ftcADM0Buffer = ee.FeatureCollection("projects/apacheta/assets/SIDS/SIDS_GAUL_1kmBufffer_ADM0");


var createCompositeMIXED = function (startYear, endYear, countryName, stackL32, stackLS, version) {

    // Boundaries created from GAUL assets
    var ftcCountryBuffer = ftcADM0Buffer.filter(ee.Filter.eq('ADM0_NAME', countryName));
    var ftcCountryBufferBounds = ftcADM0BufferBounds.filter(ee.Filter.eq('ADM0_NAME', countryName));

    // Load CCDC for gaps
    countryName = countryName.replace(/ /g, '_').replace('(', '_').replace(')', '_');
    var assetIdSuffix = countryName + '_' + startYear + '_' + endYear + '_v1';
    var stackCCDCAssetId = 'projects/apacheta-geo-ldn/assets/NDVI/CCDC/NDVI_CCDC_ForGaps_' + assetIdSuffix;
    var stackCCDC = ee.Image(stackCCDCAssetId);

    // Period to analize
    var yearsPeriod = ee.List.sequence(startYear, endYear);

    // Create a new image collection from datasets, adding bands with different ways of dealing with masked pixels
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

            // Fill remaining gaps with CCDC when possible
            var imgCurrentYearCCDC = stackCCDC.select((ee.String('NDVI_').cat(ee.String(ee.Number(y).toInt()))));
            var imgFillCCDC = imgMax.unmask(-32768).where(imgMax.unmask(-32768).eq(-32768), imgCurrentYearCCDC);
            imgFillCCDC = imgFillCCDC.updateMask(imgFillCCDC.neq(-32768)).rename('NDVI_Fill_CCDC');

            // Add all the bands
            var finalImage = imgMax
                .addBands(imgCurrentYearL32)
                .addBands(imgMeanPreSubL32)
                .addBands(imgFillGapYearL32.updateMask(imgFillGapYearL32.neq(-32768)))
                .addBands(imgCurrentYearLS)
                .addBands(imgMeanPreSubLS)
                .addBands(imgFillGapYearLS.updateMask(imgFillGapYearLS.neq(-32768)))
                .addBands(imgFillCCDC)
                .set('year', y)
                .set('system:time_start', ee.Date.fromYMD(y, 1, 1).millis());

            return finalImage;
        }));




    var imcProcesed = ee.ImageCollection.fromImages(
        yearsPeriod.map(function (y) {

            var imgCurrentYear = imcMixedCollection.filter(ee.Filter.eq('year', y)).first().select('NDVI'); // NDVI
            var imgFillCCDC = imcMixedCollection.filter(ee.Filter.eq('year', y)).first().select('NDVI_Fill_CCDC'); // NDVI
            // If this is the first year of the series, previous=current
            var prevYear = ee.Algorithms.If(ee.Number(y).eq(yearsPeriod.get(0)), ee.Number(y).toInt(), ee.Number(y).subtract(1).toInt());
            // If this is the last year of the series, subsequent=current
            var subsYear = ee.Algorithms.If(ee.Number(y).eq(yearsPeriod.get(yearsPeriod.size().subtract(1))), ee.Number(y).toInt(), ee.Number(y).add(1).toInt());

            // Calculate NDVI mean from previous and subsequent years for mixed collection
            var imgPreviousYear = imcMixedCollection.filter(ee.Filter.eq('year', prevYear)).first().select('NDVI_Fill_CCDC');
            var imgSubsequentYear = imcMixedCollection.filter(ee.Filter.eq('year', subsYear)).first().select('NDVI_Fill_CCDC');
            var imgMeanPreSub = imgPreviousYear.add(imgSubsequentYear).divide(2).rename('NDVI_Pre_Sub_mean');

            var imgDiffMeanVsCurrent = imgMeanPreSub.subtract(imgFillCCDC);

            // If difference between and NDVI (from previous and subsequente years) is greater than 10% of mean, replace with mean
            var imgOneDropReplaced = imgFillCCDC.where(imgDiffMeanVsCurrent.gte(imgMeanPreSub.multiply(0.1)), imgMeanPreSub).rename('NDVI_One_Drop_Replaced');

            // Add all the bands
            var finalImage = imgCurrentYear.rename('NDVI_Max')
                .addBands(imgFillCCDC)
                .addBands(imgOneDropReplaced)
                .toInt16()
                .set('year', y)
                .set('system:time_start', ee.Date.fromYMD(y, 1, 1).millis());

            return finalImage;


        }));

    // Create single image for export
    var newBandsNames = yearsPeriod.map(function (year) {
        var name = ee.String('NDVI_').cat(ee.String(ee.Number(year).toInt()));
        return name;
    });
    var stackMixed = imcProcesed.select('NDVI_One_Drop_Replaced').toBands().rename(newBandsNames);
    //Map.addLayer(stackMixed.clip(ftcCountryBuffer), { min: 0, max: 10000 }, 'stackMixed - Bands NDVI per year', true);
    //Map.centerObject(ftcCountryBuffer);
    
    var NDVILabel = 'NDVI_MIXED_' + countryName + '_' + startYear + '_' + endYear + '_v1' + version;

    Export.image.toAsset({
        image: stackMixed.clip(ftcCountryBuffer),
        description: 'Export_' + NDVILabel,
        assetId: 'projects/apacheta-lpd/assets/NDVI/MIXED/' + NDVILabel,
        scale: 30,
        region: ftcCountryBufferBounds,
        maxPixels: 1e13,
        crs: 'EPSG:4326'
    });
    return { imcMixedCollection: imcMixedCollection, imcProcesed: imcProcesed, stackMixed: stackMixed };
};

exports.createCompositeMIXED = createCompositeMIXED;

if (false) { // true to run export tasks 

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

    var listSIDS = ['Antigua and Barbuda'];

    listSIDS.forEach(function (countryNameTest) {
        // Parameters
        var startYearTest = 2000;
        var endYearTest = 2023;

        // Input Datasets
        //var assetIdSuffix = countryNameTest.replace(/ /g, '_').replace('(', '_').replace(')', '_') + '_' + startYearTest + '_' + endYearTest + '_v1'; 
        var assetIdSuffix = countryNameTest.replace(/ /g, '_').replace('(', '_').replace(')', '_') + '_' + startYearTest + '_' + endYearTest + '_v1_GapFillSpatial';

        // use input l32 and ls time series without or without fill spatial
        var stackL32AssetId = 'projects/apacheta1/assets/NDVI/L32/NDVI_Landsat_32d_median_' + assetIdSuffix;
        var stackLSAssetId = 'projects/apacheta-geo-ldn/assets/NDVI/LS/NDVI_Landsat_5789_median_' + assetIdSuffix;

        var stackL32 = ee.Image(stackL32AssetId).select('NDVI_.*');
        var stackLS = ee.Image(stackLSAssetId).select('NDVI_.*');

        // CCDC from assets
        createCompositeMIXED(startYearTest, endYearTest, countryNameTest, stackL32, stackLS, '_GapFillSpatial');
        //createCompositeMIXED(startYearTest, endYearTest, countryNameTest, stackL32, stackLS ,'');
    });
}

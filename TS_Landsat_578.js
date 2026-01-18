/*
This script creates a single image containing one NDVI median band per year for the requested period and SIDS. 
The output image also includes a count band for each year, indicating how many images were used to calculate the annual median.

In this script Landsat 5 (TM sensor), 7 (ETM+ sensor), 8 and 9 (OLI sensor) 
were combined in a unique image collection filtered including all available images for the period. 
A progressive spatial filter may be applied to cover the whole sudy area.

Developed by Apacheta Team .- www.apacheta.org
License: This work is licensed under a Apache License Version 2.0
Please visit this link for more information: https://www.apache.org/licenses/LICENSE-2.0
*/

var ftcADM0BufferBounds = ee.FeatureCollection("projects/apacheta/assets/SIDS/SIDS_GAUL_1kmBuffferBounds_ADM0"),
    ftcADM0Buffer = ee.FeatureCollection("projects/apacheta/assets/SIDS/SIDS_GAUL_1kmBufffer_ADM0");



var createCompositeLS = function (startYear, endYear, countryName, useGapFillSpatial) {

    // Boundaries created from GAUL assets
    var ftcCountryBuffer = ftcADM0Buffer.filter(ee.Filter.eq('ADM0_NAME', countryName));
    var ftcCountryBufferBounds = ftcADM0BufferBounds.filter(ee.Filter.eq('ADM0_NAME', countryName));

    Map.addLayer(ftcCountryBuffer, {}, 'Country buffer', false);

    // Load and merge Landsat image collections
    var imcLandsatMerged = ee.ImageCollection('LANDSAT/LT05/C02/T1_L2').select(['SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'QA_PIXEL'])
        .merge(ee.ImageCollection('LANDSAT/LE07/C02/T1_L2').select(['SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'QA_PIXEL']))
        .merge(ee.ImageCollection('LANDSAT/LC08/C02/T1_L2').select(['SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B6', 'QA_PIXEL']))
        .merge(ee.ImageCollection('LANDSAT/LC09/C02/T1_L2').select(['SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B6', 'QA_PIXEL']));


    // Scanline or Cloud Gap or masked pixel progressive filling with neighbor
    var gapFillSpatial = function (img) {
        var filter1 = img.focal_mean(1, 'square', 'pixels', 3);
        var filter2 = img.focal_mean(2, 'square', 'pixels', 3);
        var filter3 = img.focal_mean(3, 'square', 'pixels', 3);
        var newImg = img.unmask(filter1).unmask(filter2).unmask(filter3);
        return newImg;
    };

    // Function to mask clouds and clauds shadows
    function maskLandsat(image) {
        var qaBand = image.select('QA_PIXEL');
        var cloudShadowBitMask = 1 << 4;// Bit 4: Cloud Shadow
        var cloudBitMask = 1 << 3;  // Bit 5: Cloud
        var mask = qaBand.bitwiseAnd(cloudShadowBitMask).eq(0)
            .and(qaBand.bitwiseAnd(cloudBitMask).eq(0));

        return image.updateMask(mask).copyProperties(image, ['system:time_start']);
    }

    // Function to calculate and add NDVI as a band
    function addNDVI(image) {
        var NDVI = image.normalizedDifference(['NIR', 'RED']).rename('NDVI').multiply(10000).toInt16();
        var NDSI = image.normalizedDifference(['GREEN', 'SWIR1']).rename('NDSI').lte(0.5);
        return image.addBands(NDVI)
            .mask(NDSI)
            .copyProperties(image, ['system:time_start']);
    }

    // Function to apply scaling factors
    function applyScaleFactors(image) {
        var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2);
        return opticalBands.rename('BLUE', 'GREEN', 'RED', 'NIR', 'SWIR1')
            .mask(opticalBands.lte(1))
            .copyProperties(image, ['system:time_start']);
    }

    // Apply filters
    imcLandsatMerged = imcLandsatMerged
        .filterBounds(ftcCountryBufferBounds)
        .filterDate(startYear + '-01-01', endYear + '-12-31')
        .map(maskLandsat)
        .map(applyScaleFactors)
        .map(addNDVI);

    if (useGapFillSpatial)
        imcLandsatMerged = imcLandsatMerged.map(gapFillSpatial);

    var visualization = {
        bands: ['RED', 'GREEN', 'BLUE'],
        min: 0.0,
        max: 0.3,
    };
    Map.addLayer(imcLandsatMerged.filterDate('2005-01-01', '2005-12-31').median(), visualization, 'Filtered Collection RGB', false);

    var imcNDVILandsatMerged = imcLandsatMerged.select('NDVI');

    Map.addLayer(imcNDVILandsatMerged, {}, 'NDVI LS collection subset', false);
    Map.addLayer(imcNDVILandsatMerged.count().rename('NDVI_Count_Period').clip(ftcCountryBuffer),
        { min: 23, max: (12 * (endYear - startYear)), palette: ['ff0000', 'ffe000', '00da39'] },
        'NDVI LS collection subset - count() ', false);

    // Calculate the monthly median, excluding months with no images
    function calculateMonthlyMedian(collection, startYear, endYear) {
        var monthlyMedians = ee.ImageCollection(
            ee.List.sequence(startYear, endYear).map(function (year) {
                return ee.List.sequence(1, 12).map(function (month) {
                    var startDate = ee.Date.fromYMD(year, month, 1);
                    var endDate = startDate.advance(1, 'month');

                    var filtered = collection.filterDate(startDate, endDate);
                    var count = filtered.size(); // Number of images in the month

                    // Check if there are images to calculate the median
                    return ee.Algorithms.If(
                        count.gt(0),
                        filtered.median()
                            .set('year', year)
                            .set('month', month)
                            .set('count', count),
                        null // Ignore months with no images
                    );
                });
            }).flatten()
        ).filter(ee.Filter.notNull(['year'])); // Filter null values
        return monthlyMedians;
    }


    // Calculate annual median
    function calculateAnnualMedian(monthlyMedians) {
        var annualMedians = ee.ImageCollection(
            monthlyMedians.distinct('year').aggregate_array('year').map(function (year) {
                year = ee.Number(year);
                var annualMedian = monthlyMedians.filter(ee.Filter.eq('year', year))
                    .median().rename('NDVI')
                    .set('year', year);
                return annualMedian;
            })
        );
        return annualMedians;
    }


    // Callculate number of images used 
    function countAnnualCount(monthlyMedians) {
        var annualCounts = ee.ImageCollection(
            monthlyMedians.distinct('year').aggregate_array('year').map(function (year) {
                year = ee.Number(year);
                var annualCount = monthlyMedians.filter(ee.Filter.eq('year', year))
                    .count().toByte().rename('Count')
                    .set('year', year);
                return annualCount;
            })
        );
        return annualCounts;
    }

    var monthlyMedians = calculateMonthlyMedian(imcNDVILandsatMerged, startYear, endYear);
    var annualMedians = calculateAnnualMedian(monthlyMedians);
    var annualCounts = countAnnualCount(monthlyMedians);

    // Create single image with multiple bands. Rename the bands to 'NDVI_year' and 'Count_year'
    var bandNamesNDVI = annualMedians.aggregate_array('year').map(function (year) {
        return ee.String('NDVI_').cat(ee.Number(year).format('%.0f'));
    });
    var bandNamesCount = annualCounts.aggregate_array('year').map(function (year) {
        return ee.String('Count_').cat(ee.Number(year).format('%.0f'));
    });

    var imgNDVIStack = annualMedians.toBands().rename(bandNamesNDVI);
    var imgCount = annualCounts.toBands().rename(bandNamesCount);

    imgNDVIStack = imgNDVIStack.addBands(imgCount);

    Map.addLayer(imgNDVIStack.select('NDVI_.*').clip(ftcCountryBuffer), { min: 0, max: 10000 }, 'imgNDVIStack - Bands NDVI per year', false);
    Map.addLayer(imgNDVIStack.select('Count_.*').clip(ftcCountryBuffer), {}, 'imgNDVIStack - Bands Count per year', false);

    // Center to selected country
    Map.centerObject(ftcCountryBuffer);

    // Replace name spaces and parenthesis with underscores 
    countryName = countryName.replace(/ /g, '_').replace('(', '_').replace(')', '_');
    var NDVILabel = 'NDVI_Landsat_5789_median_' + countryName + '_' + startYear + '_' + endYear;
    NDVILabel = NDVILabel + '_v1' + (useGapFillSpatial ? '_GapFillSpatial' : '');

    Export.image.toAsset({
        image: imgNDVIStack.clip(ftcCountryBuffer).toInt16(),
        description: 'Export_' + NDVILabel,
        assetId: 'projects/apacheta/assets/NDVI/LS/' + NDVILabel,
        scale: 30,
        region: ftcCountryBufferBounds,
        maxPixels: 1e13,
        pyramidingPolicy: { '.default': 'mean' },
        crs: 'EPSG:4326'
    });
};


exports.createCompositeLS = createCompositeLS;

createCompositeLS(2000, 2023, 'Antigua and Barbuda', true);

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

/*
This script creates a single image containing one NDVI median band per year for the requested period and SIDS. The output image also includes a count band for each year, 
indicating how many images were used to calculate the annual median.

The input for the NDVI median image is the Landsat Collection 2 Tier 1 Level 2 32-Day NDVI Composite (courtesy of the U.S. Geological Survey), 
available in Google Earth Engine repository. A progressive spatial filter may be applied to cover the whole sudy area.

Developed by Apacheta Team .- www.apacheta.org
License: This work is licensed under a Apache License Version 2.0
Please visit this link for more information: https://www.apache.org/licenses/LICENSE-2.0

*/

var ftcADM0BufferBounds = ee.FeatureCollection("projects/apacheta/assets/SIDS/SIDS_GAUL_1kmBuffferBounds_ADM0"),
    ftcADM0Buffer = ee.FeatureCollection("projects/apacheta/assets/SIDS/SIDS_GAUL_1kmBufffer_ADM0");

var createCompositeL32 = function (startYear, endYear, countryName, useGapFillSpatial) {

    // Boundaries created from GAUL assets
    var ftcCountryBuffer = ftcADM0Buffer.filter(ee.Filter.eq('ADM0_NAME', countryName));
    var ftcCountryBufferBounds = ftcADM0BufferBounds.filter(ee.Filter.eq('ADM0_NAME', countryName));

    Map.addLayer(ftcCountryBuffer, {}, 'Country buffer', false);

    // Load Landsat dataset and apply filters
    // https://developers.google.com/earth-engine/datasets/catalog/LANDSAT_COMPOSITES_C02_T1_L2_32DAY_NDVI?hl=es-419
    var imcDataset = ee.ImageCollection('LANDSAT/COMPOSITES/C02/T1_L2_32DAY_NDVI')
        .filterBounds(ftcCountryBufferBounds)
        .filterDate(startYear + '-01-01', endYear + '-12-31');

    // Scanline or Cloud Gap or masked pixel progressive filling with neighbor
    var gapFillSpatial = function (img) {
        var filter1 = img.focal_mean(1, 'square', 'pixels', 3);
        var filter2 = img.focal_mean(2, 'square', 'pixels', 3);
        var filter3 = img.focal_mean(3, 'square', 'pixels', 3);
        var newImg = img.unmask(filter1).unmask(filter2).unmask(filter3);
        return newImg;
    };

    if (useGapFillSpatial)
        imcDataset = imcDataset.map(gapFillSpatial);

    // Load NDVI subset from dataset
    var imcNDVI = imcDataset.select('NDVI');
    var colorizedNDVIVis = {
        min: 0,
        max: 1,
        palette: [
            'ffffff', 'ce7e45', 'df923d', 'f1b555', 'fcd163', '99b718', '74a901',
            '66a000', '529400', '3e8601', '207401', '056201', '004c00', '023b01',
            '012e01', '011d01', '011301'
        ],
    };

    Map.addLayer(imcNDVI, colorizedNDVIVis, 'NDVI L32 collection subset', false);
    Map.addLayer(imcNDVI.count().rename('NDVI_Count_Period').clip(ftcCountryBuffer),
        { min: 23, max: (12 * (endYear - startYear)), palette: ['ff0000', 'ffe000', '00da39'] },
        'NDVI L32 collection subset - count() ', false);

    // List to store NDVI medians and count for each year
    var NDVIMedianList = [];

    // Create an image with the median for each year in the period
    for (var year = startYear; year <= endYear; year++) {
        var filter = imcDataset.filterDate(year + '-01-01', year + '-12-31').select('NDVI');
        NDVIMedianList.push(filter.median().multiply(10000).toInt16().rename('NDVI_' + year)); // NDVI median for the year
        NDVIMedianList.push(filter.count().toByte().rename('Count_' + year)); // Number of imaged used 
    }

    // Create single image with multiple bands. Rename the bands to 'NDVI_year' and 'Count_year'
    var imgNDVIStack = ee.ImageCollection(NDVIMedianList).toBands()
        .rename(NDVIMedianList.map(function (img) {
            return img.bandNames().get(0);
        }));

    Map.addLayer(imgNDVIStack.select('NDVI_.*').clip(ftcCountryBuffer), { min: 0, max: 10000 }, 'imgNDVIStack - Bands NDVI per year', false);
    Map.addLayer(imgNDVIStack.select('Count_.*').clip(ftcCountryBuffer), { min: 0, max: 12 }, 'imgNDVIStack - Bands Count per year', false);

    // Center to selected country
    Map.centerObject(ftcCountryBuffer);

    // Replace name spaces and parenthesis with underscores 
    countryName = countryName.replace(/ /g, '_').replace('(', '_').replace(')', '_');
    var NDVILabel = 'NDVI_Landsat_32d_median_' + countryName + '_' + startYear + '_' + endYear;
    NDVILabel = NDVILabel + '_v1' + (useGapFillSpatial ? '_GapFillSpatial' : '');

    Export.image.toAsset({
        image: imgNDVIStack.clip(ftcCountryBuffer),
        description: 'Export_' + NDVILabel,
        assetId: 'projects/apacheta1/assets/NDVI/L32/' + NDVILabel,
        scale: 30,
        region: ftcCountryBufferBounds,
        maxPixels: 1e13,
        pyramidingPolicy: { '.default': 'mean' },
        crs: 'EPSG:4326'
    });
};

exports.createCompositeL32 = createCompositeL32;

createCompositeL32(2000, 2023, 'Antigua and Barbuda', false);

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


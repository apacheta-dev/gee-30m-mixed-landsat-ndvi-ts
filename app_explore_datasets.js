/*
This application was built to enable the exploration of the 30m LPD maps created for the baseline and 
reporting periods using NDVI datasets for 2000-2023 developed in the context of SIDS.

Developed by Apacheta Team .- www.apacheta.org
License: This work is licensed under a Apache License Version 2.0
Please visit this link for more information: https://www.apache.org/licenses/LICENSE-2.0
*/

// Create Mosaics from Sentinel-2 --------------------------------
function createSentinelMosaic(startDate, endDate) {
    var s2Sr = ee.ImageCollection('COPERNICUS/S2_SR');
    var s2Clouds = ee.ImageCollection('COPERNICUS/S2_CLOUD_PROBABILITY');

    var MAX_CLOUD_PROBABILITY = 35;

    function maskClouds(img) {
        var clouds = ee.Image(img.get('cloud_mask')).select('probability');
        var isNotCloud = clouds.lt(MAX_CLOUD_PROBABILITY);
        return img.updateMask(isNotCloud);
    }

    // The masks for the 10m bands sometimes do not exclude bad data at
    // scene edges, so we apply masks from the 20m and 60m bands as well.
    // Example asset that needs this operation:
    // COPERNICUS/S2_CLOUD_PROBABILITY/20190301T000239_20190301T000238_T55GDP
    function maskEdges(s2_img) {
        return s2_img.updateMask(
            s2_img.select('B8A').mask().updateMask(s2_img.select('B9').mask()));
    }

    // Filter input collections by desired data range and region.
    var criteria = ee.Filter.and(ee.Filter.date(startDate, endDate));
    s2Sr = s2Sr.filter(criteria).map(maskEdges);
    s2Clouds = s2Clouds.filter(criteria);

    // Join S2 SR with cloud probability datasetHansen to add cloud mask.
    var s2SrWithCloudMask = ee.Join.saveFirst('cloud_mask').apply({
        primary: s2Sr,
        secondary: s2Clouds,
        condition:
            ee.Filter.equals({ leftField: 'system:index', rightField: 'system:index' })
    });

    var s2CloudMasked = ee.ImageCollection(s2SrWithCloudMask).map(maskClouds).median();

    return s2CloudMasked;
}

var START_DATE = ee.Date('2019-01-01');
var END_DATE = ee.Date('2019-05-31');

var mosaic2019 = createSentinelMosaic(START_DATE, END_DATE);
//Map.addLayer(mosaic2019, { "bands": ["B4", "B3", "B2"], "min": [50, 50, 50], "max": [1500, 2000, 1500], "gamma": 1 }, 'S2 8-4-2', true);

START_DATE = ee.Date('2023-01-01');
END_DATE = ee.Date('2023-05-31');
var mosaic2023 = createSentinelMosaic(START_DATE, END_DATE);
//Map.addLayer(mosaic2023, { "bands": ["B4", "B3", "B2"], "min": [1000, 1000, 1000], "max": [2500, 3000, 2500], "gamma": 1 }, 'S2 8-4-2', true);

// Boundaries
var ftcADM0 = ee.FeatureCollection("projects/apacheta/assets/SIDS/SIDS_GAUL_ADM0");

// 40 SIDS
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
listSIDS = listSIDS.sort();

// Script to create mixed collection time series
var mdlExportMIXED = require('users/apacheta/Mixed_Landsat_NDVI_TS:TS_MIXED.js');

// List of locations to explore
var demoPoints = {
    'Point 1 - Saint Lucia': { lon: -61.023865, lat: 13.866370 },
    'Point 2 - Samoa': { lon: -171.67186, lat: -13.93190 },
    'Point 3 - Saint Lucia': { lon: -60.99356, lat: 13.84279 },
    'Point 4 - Mauritius': { lon: 57.49608, lat: -20.24777 },
    'Point 5 - Jamaica': { lon: -76.33852, lat: 18.00804 },
};

var selectedCountry, selectedPoint = null;
var selectedFilter = '_GapFillSpatial';
var results, ftcCountry;
var startYearTest = 2000;
var endYearTest = 2023;
var stackL32AssetId, stackLSAssetId;


function loadAssets(centerObject) {

    var countryText = selectedCountry.replace(/ /g, '_').replace('(', '_').replace(')', '_');
    // Input Datasets
    var assetIdSuffix = countryText + '_' + startYearTest + '_' + endYearTest + '_v1';

    stackL32AssetId = 'projects/apacheta1/assets/NDVI/L32/NDVI_Landsat_32d_median_' + assetIdSuffix;
    stackLSAssetId = 'projects/apacheta-geo-ldn/assets/NDVI/LS/NDVI_Landsat_5789_median_' + assetIdSuffix;

    // Append '_GapFillSpatial' to asset id to load NDVI stacks with spatial fill filter
    stackL32AssetId = stackL32AssetId + selectedFilter;
    stackLSAssetId = stackLSAssetId + selectedFilter;

    var stackL32 = ee.Image(stackL32AssetId).select('NDVI_.*');
    var stackLS = ee.Image(stackLSAssetId).select('NDVI_.*');

    results = mdlExportMIXED.createCompositeMIXED(startYearTest, endYearTest, selectedCountry, stackL32, stackLS);

    loadLayers(countryText, centerObject);

    pnlCharts.clear();

    lat.setValue('');
    lon.setValue('');

}

/* UI Components */

/* App information labels */
var lblSubTitle = ui.Label({
    value: 'This app was designed to enable the exploration of a gap-filled, 30m NDVI time series \
    derived entirely from Landsat imagery (Landsat 5, 7, 8, and 9) spanning 2000-2023. \
    This high-resolution time series is generated by integrating available Landsat scenes with a Landsat 32-Day \
    NDVI Composite and synthetic images produced using the CCDC \
    algorithm to mitigate data gaps, including those resulting from the Landsat 7 SLC failure. \
    Spatial and temporal filters are applied to correct for cloud effects and missing data across 40 SIDS. \
    This comprehensive dataset serves as the basis for deriving LPD products, \
    specifically tailored to support UNCCD SDG 15.3.1 reporting, thereby providing an enhanced foundation for \
    evidence-based decision-making and sustainable land management. (*)',
    style: { fontSize: '12px', margin: '5px 5px' }
});

/* Report link */
var lblReportLink = ui.Label({
    value: 'Link to the report on how the 30m LANDSAT NDVI time series and LPD maps were created.',
    targetUrl: 'https://drive.google.com/file/d/10nYq6pHmikC6GFuan65bJ5A6QnNry59E/view?usp=sharing',
    style: { fontSize: '12px', margin: '5px 5px' }
});

/* Citation panel */
var lblCite = ui.Label({
    value: 'More info/cite as:',
    targetUrl: '',
    style: { fontSize: '12px', margin: '5px 5px' }
});
var lblDOI = ui.Label({
    value: '10.5281/zenodo.15276536',
    targetUrl: '10.5281/zenodo.15276536',
    style: { fontSize: '12px', margin: '5px 5px' }
});
var pnlCite = ui.Panel({
    layout: ui.Panel.Layout.flow('horizontal'),
    widgets: [lblCite, lblDOI]
});

/* Coordinates labels */
var lon = ui.Label({ style: { fontSize: '12px', margin: '5px 5px' } });
var lat = ui.Label({ style: { fontSize: '12px', margin: '5px 5px' } });

/* SIDS selector */
var handleOnChangeSIDS = function (SIDS) {
    selectedCountry = SIDS;
    ftcCountry = ftcADM0.filter(ee.Filter.eq('ADM0_NAME', SIDS));
    selectedPoint = null;
    loadAssets(true);
    // Unselect demo points
    selDemoPoints.unlisten();
    selDemoPoints.setValue(null);
    selDemoPoints.onChange(handleOnChangeDemoPoint);

};
var selSIDS = ui.Select({
    items: listSIDS,
    style: { width: "90%" },
    placeholder: "Select SIDS",
    onChange: handleOnChangeSIDS,
});

/* Filter selector */
var handleOnChangeFilter = function (filter) {
    selectedFilter = filter;
    loadAssets(false);
    if (selectedPoint !== null)
        handleOnClickMap(selectedPoint);
};
var selFilter = ui.Select({
    items: [{
        label: 'NDVI TS - With spatial gap filter',
        value: '_GapFillSpatial'
    },
    {
        label: 'NDVI TS - Without spatial gap filter',
        value: ''
    }],
    value: selectedFilter,
    style: { width: "60%" },
    placeholder: "Select filter",
    onChange: handleOnChangeFilter,
});

/* Demo points selector */
var handleOnChangeDemoPoint = function (pointName) {
    selectedPoint = demoPoints[pointName];
    var ftcSIDS = ftcADM0.filterBounds(ee.Geometry.Point(selectedPoint.lon, selectedPoint.lat));
    selectedCountry = ftcSIDS.first().get('ADM0_NAME').getInfo();
    ftcCountry = ftcADM0.filter(ee.Filter.eq('ADM0_NAME', selectedCountry));
    loadAssets(true);
    handleOnClickMap(selectedPoint);

    // Select country
    selSIDS.unlisten();
    selSIDS.setValue(selectedCountry);
    selSIDS.onChange(handleOnChangeSIDS);
};
var selDemoPoints = ui.Select({
    items: Object.keys(demoPoints),
    style: { width: "60%" },
    placeholder: "Select a point",
    onChange: handleOnChangeDemoPoint,
});

/* Intro panel */
var intro = ui.Panel([
    ui.Label({
        value: '30m NDVI Time Series and LPD maps explorer',
        style: { fontSize: '20px', fontWeight: 'bold' }
    }),
    lblSubTitle,
    //pnlCite,
    //lblReportLink,
    selSIDS,
    ui.Label({
        value: 'Click on a point on the map or select a location from the list below to inspect different NDVI Time Series in a chart.',
        style: { fontSize: '12px', margin: '5px 5px' }
    }),
    selDemoPoints,
    ui.Panel([lon, lat], ui.Panel.Layout.flow('horizontal')),
    selFilter,
]);

/* Right panel*/
var rightPanel = ui.Panel();
rightPanel.style().set('width', '30%');
rightPanel.add(intro);

/* Map panel*/
var map = ui.Map();
map.style().set('cursor', 'crosshair');
map.setOptions({ mapTypeId: 'SATELLITE' });

/* Charts panel*/
var pnlCharts = ui.Panel();
rightPanel.widgets().add(pnlCharts);

/* Contact panel */
var lblQuestions = ui.Label({
    value: 'For questions and feedback please contact:',
    style: { fontSize: '12px', margin: '5px 5px' }
});
var lblContact = ui.Label({
    value: 'info@apacheta.org',
    targetUrl: 'mailto: info@apacheta.org',
    style: { fontSize: '12px', margin: '5px 5px' }
});
var pnlContact = ui.Panel({
    layout: ui.Panel.Layout.flow('horizontal'),
    widgets: [lblQuestions, lblContact]
});
rightPanel.widgets().add(pnlContact);

/* Disclaimer */
var lblDisclaimer = ui.Label({
    value: '(*) The boundaries, names, and designations used on maps in this \
     app do not imply any opinion whatsoever from Apacheta LLC regarding the legal status of any country,  \
     territory, city, or area, nor do they imply any opinion concerning the delimitation of frontiers and  \
     boundaries. The mention of specific products, whether or not these have been patented,  \
     does not imply endorsement or recommendation by Apacheta LLC, PISLM, CI or Apacheta Foundation in preference  \
     to others of a similar nature that are not mentioned.',
    style: { fontSize: '12px', margin: '5px 5px' }
});
rightPanel.widgets().add(lblDisclaimer);

ui.root.clear();
ui.root.add(ui.SplitPanel(map, rightPanel, "horizontal"));

var indexSelectedPoint;
var handleOnClickMap = function (coords) {
    var point = ee.Geometry.Point(coords.lon, coords.lat);
    lon.setValue('lon: ' + coords.lon.toFixed(5));
    lat.setValue('lat: ' + coords.lat.toFixed(5));

    // Save selected point
    selectedPoint = coords;

    map.layers().set(indexSelectedPoint, ui.Map.Layer(point, { color: 'purple' }, 'Selected point'));

    // Chart with NDVI MIXED TIME SERIES
    var seriesList = results.imcProcesed.iterate(function (img, a) {
        var lstFeatures = img.bandNames().map(function (bandName) {
            bandName = ee.String(bandName);
            var year = img.select(bandName).get('year');
            var singleImage = img.select(bandName);
            var ndvi = singleImage.reduceRegion({
                reducer: ee.Reducer.mean(),
                geometry: point,
                scale: 1
            }).get(bandName);
            return ee.Feature(null, { 'ndvi': ndvi, 'year': year, 'series': bandName });
        });
        return ee.List(a).cat(lstFeatures);
    }, ee.List([]));

    var ftcFlat = ee.FeatureCollection(ee.List(seriesList).flatten()).sort('series');

    var chartNDVIMixed = ui.Chart.feature.groups({
        features: ftcFlat,
        xProperty: 'year',
        yProperty: 'ndvi',
        seriesProperty: 'series'
    }).setOptions({
        title: 'NDVI mixed',
        hAxis: { 'title': 'Calendar_Year', format: '####' },
        vAxis: { 'title': 'Index * 10000' },
        series: {
            0: { color: '#aaaed6', lineWidth: 13 },
            1: { color: '#b2d6b1', lineWidth: 13 },
            2: { color: 'Red' },
        }
    });

    // Chart  - original stacks
    var seriesListNDVI = results.imcMixedCollection.select(['L32_Median', 'LS_Median']).iterate(function (img, a) {
        var lstFeatures = img.bandNames().map(function (bandName) {
            bandName = ee.String(bandName);
            var year = img.select(bandName).get('year');
            var singleImage = img.select(bandName);
            var ndvi = singleImage.reduceRegion({
                reducer: ee.Reducer.mean(),
                geometry: point,
                scale: 1
            }).get(bandName);
            return ee.Feature(null, { 'ndvi': ndvi, 'year': year, 'series': bandName });
        });
        return ee.List(a).cat(lstFeatures);
    }, ee.List([]));

    var ftcFlatNDVI = ee.FeatureCollection(ee.List(seriesListNDVI).flatten());

    var chartNDVIOriginal = ui.Chart.feature.groups({
        features: ftcFlatNDVI,
        xProperty: 'year',
        yProperty: 'ndvi',
        seriesProperty: 'series'
    }).setOptions({
        title: 'NDVI original stacks',
        hAxis: { 'title': 'Calendar_Year', format: '####' },
        vAxis: { 'title': 'Index * 10000' },
        series: {
            0: { color: 'red' },
            1: { color: 'green' },
        }
    });

    // Chart count
    var stackL32 = ee.Image(stackL32AssetId).select('Count_.*');
    var stackLS = ee.Image(stackLSAssetId).select('Count_.*');

    var lstFeaturesL32 = stackL32.bandNames().map(function (bandName) {
        bandName = ee.String(bandName);
        var year = ee.Number(bandName.slice(bandName.index('_').add(1)))
        var singleImage = stackL32.select(bandName);
        var count = singleImage.reduceRegion({
            reducer: ee.Reducer.mean(),
            geometry: point,
            scale: 1
        }).get(bandName);
        return ee.Feature(null, { 'count': count, 'year': year, 'series': 'L32' });
    });
    var lstFeaturesLS = stackLS.bandNames().map(function (bandName) {
        bandName = ee.String(bandName);
        var year = ee.Number(bandName.slice(bandName.index('_').add(1)));
        var singleImage = stackLS.select(bandName);
        var count = singleImage.reduceRegion({
            reducer: ee.Reducer.mean(),
            geometry: point,
            scale: 1
        }).get(bandName);
        return ee.Feature(null, { 'count': count, 'year': year, 'series': 'LS' });
    });
    var ftcAll = ee.FeatureCollection(lstFeaturesL32.cat(lstFeaturesLS));

    var chartCount = ui.Chart.feature.groups({
        features: ftcAll,
        xProperty: 'year',
        yProperty: 'count',
        seriesProperty: 'series'
    }).setOptions({
        title: 'NDVI original stacks - number of images used to calculate year median',
        hAxis: { 'title': 'Calendar_Year', format: '####' },
        vAxis: { 'title': 'Number of images' },
        series: {
            0: { color: 'red' },
            1: { color: 'green' },

        }
    });
    pnlCharts.clear();
    pnlCharts.widgets().add(chartNDVIOriginal);
    pnlCharts.widgets().add(chartNDVIMixed);
    pnlCharts.widgets().add(chartCount);
};

var visLPD = {
    max: 5,
    min: 0,
    opacity: 1,
    palette: ['black', '#f23c46', '#ffae4c', '#ffff73', '#d9d8e6', '#267300'],
};


function loadLayers(countryName, centerObject) {

    if (centerObject)
        map.centerObject(ftcCountry);

    map.clear();

    map.addLayer(mosaic2019, { "bands": ["B4", "B3", "B2"], "min": [50, 50, 50], "max": [1500, 2000, 1500], "gamma": 1 }, 'Sentinel2 (8-4-2) 2019', false);
    map.addLayer(mosaic2023, { "bands": ["B4", "B3", "B2"], "min": [1000, 1000, 1000], "max": [2500, 3000, 2500], "gamma": 1 }, 'Sentinel2 (8-4-2) 2023', false);

    map.addLayer(results.stackMixed, { bands: ["NDVI_2000", "NDVI_2010", "NDVI_2023"], min: [3000], max: [9000] }, 'Years 2000/2010/2015 (RGB) - NDVI Mixed' + selFilter.getValue(), false);
    map.addLayer(results.stackMixed, { bands: ["NDVI_2000"], min: [3000], max: [9000], palette: ["914646", "ffc800", "004e06"] }, 'Year 2000 (Colorized) - NDVI Mixed' + selFilter.getValue(), false);

    var assetIdLPD1 = "projects/apacheta-lpd/assets/LPD_FWv2/LPD_FWv2_" + countryName + "_2000_2015_v1";
    var assetIdLPD2 = "projects/apacheta-lpd/assets/LPD_FWv2/LPD_FWv2_" + countryName + "_2005_2019_v1";
    var assetIdLPD3 = "projects/apacheta-lpd/assets/LPD_FWv2/LPD_FWv2_" + countryName + "_2009_2023_v1";

    map.addLayer(ee.Image(assetIdLPD1), visLPD, 'LPD Baseline 2000_2015 FW v2', false);
    map.addLayer(ee.Image(assetIdLPD2), visLPD, 'LPD Rep. Period 1 2005_2019 FW v2', false);
    map.addLayer(ee.Image(assetIdLPD3), visLPD, 'LPD Rep. Period 2 2009_2023 FW v2', true);

    map.onClick(handleOnClickMap);

    indexSelectedPoint = map.layers().length();
}

// Load point 0 from the selected country at startup
selDemoPoints.setValue(Object.keys(demoPoints)[0]);



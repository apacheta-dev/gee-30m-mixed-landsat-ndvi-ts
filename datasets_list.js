// This is Dataset are provided in the context of this citation:

//García, C. L., Pozzi Tay, E. F., Raviolo, E., Maharaj, T., Francis, R.,
//Zvoleff, A., Antunes Daldegan, G., Paredes-Trejo, F., Noon, M. & James, C (2025).
//Annual 30m NDVI Time Series from Mixed Landsat Images. 
//Zenodo. https://doi.org/10.5281/zenodo.15276535

// Refer to that Zenodo repo for futher explanation and data License - https://creativecommons.org/licenses/by/4.0/

// Diccionario de imágenes por país
var countryImages = {
  'Antigua_and_Barbuda': 'projects/apacheta-lpd/assets/NDVI/MIXED/NDVI_MIXED_Antigua_and_Barbuda_2000_2023_v1_GapFillSpatial',
  'Bahamas': 'projects/apacheta-lpd/assets/NDVI/MIXED/NDVI_MIXED_Bahamas_2000_2023_v1_GapFillSpatial',
  'Bahrain': 'projects/apacheta-lpd/assets/NDVI/MIXED/NDVI_MIXED_Bahrain_2000_2023_v1_GapFillSpatial',
  'Barbados': 'projects/apacheta-lpd/assets/NDVI/MIXED/NDVI_MIXED_Barbados_2000_2023_v1_GapFillSpatial',
  'Belize': 'projects/apacheta-lpd/assets/NDVI/MIXED/NDVI_MIXED_Belize_2000_2023_v1_GapFillSpatial',
  'Cape_Verde': 'projects/apacheta-lpd/assets/NDVI/MIXED/NDVI_MIXED_Cape_Verde_2000_2023_v1_GapFillSpatial',
  'Comoros': 'projects/apacheta-lpd/assets/NDVI/MIXED/NDVI_MIXED_Comoros_2000_2023_v1_GapFillSpatial',
  'Cook_Islands': 'projects/apacheta-lpd/assets/NDVI/MIXED/NDVI_MIXED_Cook_Islands_2000_2023_v1_GapFillSpatial',
  'Cuba': 'projects/apacheta-lpd/assets/NDVI/MIXED/NDVI_MIXED_Cuba_2000_2023_v1_GapFillSpatial',
  'Dominica': 'projects/apacheta-lpd/assets/NDVI/MIXED/NDVI_MIXED_Dominica_2000_2023_v1_GapFillSpatial',
  'Dominican_Republic': 'projects/apacheta-lpd/assets/NDVI/MIXED/NDVI_MIXED_Dominican_Republic_2000_2023_v1_GapFillSpatial',
  'Fiji': 'projects/apacheta-lpd/assets/NDVI/MIXED/NDVI_MIXED_Fiji_2000_2023_v1_GapFillSpatial',
  'Grenada': 'projects/apacheta-lpd/assets/NDVI/MIXED/NDVI_MIXED_Grenada_2000_2023_v1_GapFillSpatial',
  'Guinea_Bissau': 'projects/apacheta-lpd/assets/NDVI/MIXED/NDVI_MIXED_Guinea-Bissau_2000_2023_v1_GapFillSpatial',
  'Guyana': 'projects/apacheta-lpd/assets/NDVI/MIXED/NDVI_MIXED_Guyana_2000_2023_v1_GapFillSpatial',
  'Haiti': 'projects/apacheta-lpd/assets/NDVI/MIXED/NDVI_MIXED_Haiti_2000_2023_v1_GapFillSpatial',
  'Jamaica': 'projects/apacheta-lpd/assets/NDVI/MIXED/NDVI_MIXED_Jamaica_2000_2023_v1_GapFillSpatial',
  'Kiribati': 'projects/apacheta-lpd/assets/NDVI/MIXED/NDVI_MIXED_Kiribati_2000_2023_v1_GapFillSpatial',
  'Maldives': 'projects/apacheta-lpd/assets/NDVI/MIXED/NDVI_MIXED_Maldives_2000_2023_v1_GapFillSpatial',
  'Marshall_Islands': 'projects/apacheta-lpd/assets/NDVI/MIXED/NDVI_MIXED_Marshall_Islands_2000_2023_v1_GapFillSpatial',
  'Mauritius': 'projects/apacheta-lpd/assets/NDVI/MIXED/NDVI_MIXED_Mauritius_2000_2023_v1_GapFillSpatial',
  'Micronesia': 'projects/apacheta-lpd/assets/NDVI/MIXED/NDVI_MIXED_Micronesia__Federated_States_of__2000_2023_v1_GapFillSpatial',
  'Nauru': 'projects/apacheta-lpd/assets/NDVI/MIXED/NDVI_MIXED_Nauru_2000_2023_v1_GapFillSpatial',
  'Niue': 'projects/apacheta-lpd/assets/NDVI/MIXED/NDVI_MIXED_Niue_2000_2023_v1_GapFillSpatial',
  'Palau': 'projects/apacheta-lpd/assets/NDVI/MIXED/NDVI_MIXED_Palau_2000_2023_v1_GapFillSpatial',
  'Papua_New_Guinea': 'projects/apacheta-lpd/assets/NDVI/MIXED/NDVI_MIXED_Papua_New_Guinea_2000_2023_v1_GapFillSpatial',
  'Saint_Kitts_and_Nevis': 'projects/apacheta-lpd/assets/NDVI/MIXED/NDVI_MIXED_Saint_Kitts_and_Nevis_2000_2023_v1_GapFillSpatial',
  'Saint_Lucia': 'projects/apacheta-lpd/assets/NDVI/MIXED/NDVI_MIXED_Saint_Lucia_2000_2023_v1_GapFillSpatial',
  'Saint_Vincent_and_the_Grenadines': 'projects/apacheta-lpd/assets/NDVI/MIXED/NDVI_MIXED_Saint_Vincent_and_the_Grenadines_2000_2023_v1_GapFillSpatial',
  'Samoa': 'projects/apacheta-lpd/assets/NDVI/MIXED/NDVI_MIXED_Samoa_2000_2023_v1_GapFillSpatial',
  'Sao_Tome_and_Principe': 'projects/apacheta-lpd/assets/NDVI/MIXED/NDVI_MIXED_Sao_Tome_and_Principe_2000_2023_v1_GapFillSpatial',
  'Seychelles': 'projects/apacheta-lpd/assets/NDVI/MIXED/NDVI_MIXED_Seychelles_2000_2023_v1_GapFillSpatial',
  'Singapore': 'projects/apacheta-lpd/assets/NDVI/MIXED/NDVI_MIXED_Singapore_2000_2023_v1_GapFillSpatial',
  'Solomon_Islands': 'projects/apacheta-lpd/assets/NDVI/MIXED/NDVI_MIXED_Solomon_Islands_2000_2023_v1_GapFillSpatial',
  'Suriname': 'projects/apacheta-lpd/assets/NDVI/MIXED/NDVI_MIXED_Suriname_2000_2023_v1_GapFillSpatial',
  'Timor_Leste': 'projects/apacheta-lpd/assets/NDVI/MIXED/NDVI_MIXED_Timor-Leste_2000_2023_v1_GapFillSpatial',
  'Tonga': 'projects/apacheta-lpd/assets/NDVI/MIXED/NDVI_MIXED_Tonga_2000_2023_v1_GapFillSpatial',
  'Trinidad_and_Tobago': 'projects/apacheta-lpd/assets/NDVI/MIXED/NDVI_MIXED_Trinidad_and_Tobago_2000_2023_v1_GapFillSpatial',
  'Tuvalu': 'projects/apacheta-lpd/assets/NDVI/MIXED/NDVI_MIXED_Tuvalu_2000_2023_v1_GapFillSpatial',
  'Vanuatu': 'projects/apacheta-lpd/assets/NDVI/MIXED/NDVI_MIXED_Vanuatu_2000_2023_v1_GapFillSpatial'
};

// Label para mostrar nombre del asset
var assetLabel = ui.Label({
  value: 'Selecciona un país para ver su asset.',
  style: {margin: '10px 0 0 0', fontSize: '12px', color: 'gray'}
});

// Función para manejar la selección
var onSelectCountry = function(countryName) {
  Map.layers().reset(); // Borra capas previas
  
  var assetPath = countryImages[countryName];
  assetLabel.setValue('Asset: ' + assetPath);
  
  var image = ee.Image(assetPath);
  
  Map.addLayer(
    image,
    {"bands": ["NDVI_2001", "NDVI_2015", "NDVI_2023"], "min": -200, "max": 10000},
    countryName
  );
  
  // Hace zoom al área del país
  image.geometry().bounds().evaluate(function(bounds) {
    Map.centerObject(ee.Geometry(bounds));
  });
};

// Desplegable
var countrySelect = ui.Select({
  items: Object.keys(countryImages),
  placeholder: 'Select Country',
  onChange: onSelectCountry
});

// Panel de control
var panel = ui.Panel({
  widgets: [
    ui.Label('Open 30m NDVI Time Series from Mixed Landsat', {fontWeight: 'bold'}),
    countrySelect,
    assetLabel
  ],
  style: {width: '300px', padding: '8px', position: 'top-left'}
});

Map.add(panel);

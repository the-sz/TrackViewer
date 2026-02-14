[![codecov](https://codecov.io/gh/the-sz/TrackViewer/branch/master/graph/badge.svg?token=5XI6XLR02W)](https://codecov.io/gh/the-sz/TrackViewer)
[![Codacy Badge](https://app.codacy.com/project/badge/Coverage/38ed52e629ba4982b86f0451328f34c5)](https://www.codacy.com/gh/the-sz/TrackViewer/dashboard?utm_source=github.com&utm_medium=referral&utm_content=the-sz/TrackViewer&utm_campaign=Badge_Coverage)
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/38ed52e629ba4982b86f0451328f34c5)](https://www.codacy.com/gh/the-sz/TrackViewer/dashboard?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=the-sz/TrackViewer&amp;utm_campaign=Badge_Grade)
[![License: GPL v3](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](http://www.gnu.org/licenses/gpl-3.0)

# TrackViewer

Visualize your KML, KMZ, GPX or TCX track in 3D and 2D. Rotate, Tilt and Zoom into your track.

In 2D you can see each recorded position. The tooltip will show you the exact time and height.

## Demo
See https://the-sz.com/products/track_viewer/ for a real life demo.

## 3D Cesium Style
![](.github/sample_3d_cesium.png)

The track is shown on a map from [CesiumJS](https://cesium.com/platform/cesiumjs/). The map can be the Cesium default Bing Maps (`style: trackViewer.style3DCesiumDefault`) or from Google Maps with Photorealistic 3D Tiles (`style: trackViewer.style3DCesiumGoogle`).

For Cesium Style, you need to load `track_viewer_module.js` as module before the normal `track_viewer.js` like `<script src="track_viewer_module.js" type="module"></script>`.

The map can have 3D terrain or can be flat:
### 3D terrain
`elevation: trackViewer.elevationFromMap` will show a 3D terrain with the track laid onto the terrain.

### Flat map with Elevation from track
`elevation: trackViewer.elevationFromFile` will show a flat map where the track is shown in 3D. The elevation is taken from the track.

### Flat
`elevation: trackViewer.elevationNone` will show a flat map with a flat track.

## 3D MapBox Style
![](.github/sample_3d_mapbox.png)

The track is shown on a map from [MapBox](https://www.mapbox.com/). The map can be a street map (`style: trackViewer.style3DMapboxStreetMap`) or a satellite map (`style: trackViewer.style3DMapboxSatellite`).

The map can have 3D terrain or can be flat:
### 3D terrain
`elevation: trackViewer.elevationFromMap` will show a 3D terrain with the track laid onto the terrain.

### Flat map with Elevation from track
`elevation: trackViewer.elevationFromFile` will show a flat map where the track is shown in 3D. The elevation is taken from the track.

### Flat
`elevation: trackViewer.elevationNone` will show a flat map with a flat track.

## 2D Style
![](.github/sample_2d.jpg)

The track will be shown on a street map from [Google Maps](https://maps.google.com/). You can decide whether every track record (`style: trackViewer.style2DAllRecords`) or only one record per minute (`style: trackViewer.style2DOneRecordPerMinute`) should be shown as a dot. Using `useLines: true` will connect all dots.

## 3D Style
![](.github/sample_3d.jpg)

Track records will be shown in 3D space using bars or `useDots: false` dots. The background can be a Google street map (`style: trackViewer.style3DStreetMap`), a Google satellite map (`style: trackViewer.style3DSatellite`), a blue rectangle (`style: trackViewer.style3DBlueBackground`) or nothing (`style: trackViewer.style3DNoBackground`).

## Examples
[Select](./examples/select.html)
This example shows how to use a track file selected by user from the local computer. It also allows you to select all possible styles.

[Remote](./examples/remote.html)
This example shows how to load track from a server. The track is shown in full window size. The used styles are hard coded.

> Note: You must specify your MapBox access token, Cesium access token and Google maps key in the HTML files. Search for \*\*\*KEY\*\*\*.

## Options
### style: trackViewer.style3DMapboxSatellite
In which style the track will be shown.
### elevation: trackViewer.elevationFromMap
How the elevation is shown in the 3D MapBox style.
### useLines: false
Whether the dots in 2D style shown be connected with a line or not.
### useDots: false
Whether the track records should be shown as bars or dots in 3D style.
### mapBoxAccessToken: null
Specify your MapBox access token.
### googleMapsKey: null
Specify your Google maps key.
### cesiumAccessToken: null
Specify your Cesium access token.
### domContainer: null
HTML object where the map will be rendered.
### domHeader: null
HTML object which height should be accounted for when resizing the map.
### domFullScreenControl: null
HTML object which will switch to and from full screen in 3D style.
### domInfo: null
HTML object which will be hidden if the track gets shown.
### spacingRight: 25
Number of spacing pixels to the right of the map.
### dotImageLight: 'dotlight.png'
Dot image shown in `trackViewer.style2DAllRecords` style.
### dotImageLightAnchorX: 8
X center of the `dotImageLight` image.
### dotImageLightAnchorY: 8
Y center of the `dotImageLight` image.
### dotImageHeavy: 'dotheavy.png'
Dot image shown in `trackViewer.style2DOneRecordPerMinute` style.
### dotImageHeavyAnchorX: 13
X center of the `dotImageHeavy` image.
### dotImageHeavyAnchorY: 13
Y center of the `dotImageHeavy` image.
### lineColor2D: '#0776FF'
Color of the connecting line in 2D style if `useLines: true`.
### lineOpacity2D: 0.5
Opacity of the connecting line in 2D style if `useLines: true`.
### lineWeight2D: 2
Weight of the connecting line in 2D style if `useLines: true`.
### lineColor3DMapBoxElevationFromMap: 'rgba(7, 118, 255, 1.0)'
Track color in 3D MapBox style if `elevation: trackViewer.elevationFromMap` or `elevation: trackViewer.elevationNone`.
### lineColor3DMapBoxElevationFromFile: [7, 118, 255, 255]
Track color in 3D MapBox style if `elevation: trackViewer.elevationFromFile`.
### lineWidth3DMapBoxElevationFromMap: 3
Track width in 3D MapBox style if `elevation: trackViewer.elevationFromMap` or `elevation: trackViewer.elevationNone`.
### lineWidth3DMapBoxElevationFromFile: 1
Track width in 3D MapBox style if `elevation: trackViewer.elevationFromFile`.
### lineColor3DCesium: '#0776FF',
Track color in 3D Cesium styles.
### lineWidth3DCesium: 2,
Track width in 3D Cesium styles.
### dotSize3DCesium: 5,
If `useDots: true`, in Cesium styles, each track record has a dot and can be clicked to show the exact time and height.
### cameraMove3DCesium: 'fly',
How should the camera in Cesium styles move to the start of the track. `fly` or `set`.
### lineColor3D: 0xFF0000
Color of the lines/bars in 3D style.

## License
[GNU General Public License v3.0](LICENSE.md)

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fthe-sz%2FTrackViewer.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2Fthe-sz%2FTrackViewer?ref=badge_shield)

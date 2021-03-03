const assert=require('assert');
const sinon=require('sinon');
const fs=require('fs');
const chai=require('chai');
const expect=chai.expect;

// create zip
const JSZip=require("node-zip");
global.JSZip=JSZip;

// create jquery
const { JSDOM } = require('jsdom');
const jsdom = new JSDOM('<!doctype html><html><body></body></html>');
const { window } = jsdom;
global.jQuery=require('jquery')(window);
global.$=global.jQuery;
global.window=window;

// create document
global.document={ getElementById(id) { return null; }};

// navigator
global.navigator={ language: 'en' };

// FileReader
global.FileReader=class FileReader
{
	onload(event) { }
	readAsText(fileBlob) { this.onload(fileBlob); }
};

// create mapbox
global.mapboxgl={ };
mapboxgl.Map=class Map
{
	constructor(parameter) { }

	on(string,callback)
	{
		callback();
	}

	addSource(string,parameter) { }

	setTerrain(parameter) { }

	addControl(object) { }

	addLayer(object) { }
};

mapboxgl.FullscreenControl=class FullscreenControl
{
};

mapboxgl.LngLatBounds=class LngLatBounds
{
	extend(array) { }
};

DeckGL=class DeckGL
{
};

var PathLayerData=[];
PathLayer=class PathLayer
{
	constructor(parameter)
	{
		PathLayerData.push(parameter.data[0].path);
	}
};

global.deck={ DeckGL, PathLayer };

// create google
global.google={ };
global.google.maps={ };
google.maps.Map=class Map
{
	setCenter(parameter) { }
}
google.maps.Point=class Point
{
}
google.maps.Polyline=class Polyline
{
}
global.google.maps.marker=[];
google.maps.Marker=class Marker
{
	constructor(parameter)
	{
		global.google.maps.marker.push(parameter);
	}
}

// create luxon
global.luxon={ };
global.luxon.DateTime={ fromISO() { return this; }, setLocale() { return this; } };

// create THREE
global.THREE={ };
THREE.ImageUtils={ crossOrigin: '' };
THREE.Scene=class Scene
{
	add(object) { }
}
THREE.FogExp2=class FogExp2
{
}
THREE.PerspectiveCamera=class PerspectiveCamera
{
	position={ set() { } }
	updateProjectionMatrix() { }
}
THREE.Vector3=class Vector3
{
	normalize() { return this; }
}
THREE.Mesh=class Mesh
{
	rotateOnAxis(vector) { }
	updateMatrix() { }
	scale={ y: 0 }
	position={ x: 0, y: 0, z: 0 }
}
THREE.DodecahedronGeometry=class DodecahedronGeometry
{
}
THREE.CylinderGeometry=class CylinderGeometry
{
}
THREE.PlaneBufferGeometry=class PlaneBufferGeometry
{
}
THREE.MeshPhongMaterial=class MeshPhongMaterial
{
}
THREE.MeshLambertMaterial=class MeshLambertMaterial
{
}
THREE.OrbitControls=class OrbitControls
{
	addEventListener() { }
}
THREE.DirectionalLight=class DirectionalLight
{
	position={ set() { } }
}
THREE.AmbientLight=class AmbientLight
{
}
THREE.WebGLRenderer=class WebGLRenderer
{
	setClearColor() { }
	setPixelRatio() { }
	setSize() { }
	render() { }
	domElement=$('<div></div>')[0];
}

// load script
var trackViewer=require('../src/track_viewer.js');

// tests
describe('Init()',function()
{
	beforeEach(function(done)
	{
		sinon.spy(global.window);
		$=sinon.stub();
		done();
	});

	afterEach(function(done)
	{
		sinon.restore();
		$=jQuery;
		done();
	});

	it('should init everything',function()
	{
		var jQueryOffset={ left: 6 };

		// $(null)
		var spyNull=sinon.spy(	{	height(height) { return 2; },
											width(width) { return 3; },
											offset(offset) { return jQueryOffset; },
											click() { }
										});
		$.withArgs(null).returns(spyNull);

		// $(window)
		var spyWindow=sinon.spy(	{	height(height) { return 4; },
												width(width) { return 5; }
											});
		$.withArgs(window).returns(spyWindow);

		// $(domHeader)
		var domHeader=sinon.spy(	{	height(height) { return 2; } });
		$.withArgs(domHeader).returns(domHeader);

		// init track viewer
		var settings={ spacingRight: 10, domHeader: domHeader };
		trackViewer.init(settings);

		assert(global.window.addEventListener.calledOnceWith('resize'));

		assert(spyNull.height.calledOnce);
		expect(spyNull.height.args[0][0]).to.equal(spyWindow.height.returnValues[0] - domHeader.height.returnValues[0]);

		assert(spyNull.width.calledOnce);
		expect(spyNull.width.args[0][0]).to.equal((spyWindow.width.returnValues[0] - jQueryOffset.left - settings.spacingRight));
	});
});

describe('Load()',function()
{
	function test2D(_this,file,count,coordinates,done)
	{
		var stub=null;

		_this.timeout(30*1000);

		global.google.maps.marker=[];

		var fileContent=fs.readFileSync(file);

		stub=sinon.stub(global.jQuery,'ajax');

		trackViewer.load(file,{ style: trackViewer.style2DAllRecords, useLines: false, domContainer: $('<div></div>')[0], domHeader: null });

		stub.yieldTo('success',fileContent);

		stub.restore();

		// verify that coords match
		expect(global.google.maps.marker.length).to.equal(count);
		//console.log(global.google.maps.marker);
		for (index=0;index<coordinates.length;index++)
		{
			expect(global.google.maps.marker[index].position).deep.to.equal({ lat: coordinates[index][1], lng: coordinates[index][0]});
		}

		done();
	}

	function test2DBlob(_this,file,count,coordinates,done)
	{
		var stub=null;

		_this.timeout(30*1000);

		global.google.maps.marker=[];

		var fileContent=fs.readFileSync(file).toString();

		// create blob for our fake FileReader
		var fileBlob={ name: file, target: { result: fileContent } };

		trackViewer.load(fileBlob,{ style: trackViewer.style2DAllRecords, useLines: true, domContainer: $('<div></div>')[0], domHeader: null });

		// verify that coords match
		expect(global.google.maps.marker.length).to.equal(count)
		//console.log(global.google.maps.marker);
		for (index=0;index<coordinates.length;index++)
		{
			expect(global.google.maps.marker[index].position).deep.to.equal({ lat: coordinates[index][1], lng: coordinates[index][0]});
		}

		done();
	}

	function test3D(_this,file,count,positions,done)
	{
		_this.timeout(30*1000);

		var fileContent=fs.readFileSync(file);

		var stub=sinon.stub(global.jQuery,'ajax');

		var add=sinon.spy(THREE.Scene.prototype,'add');
		
		trackViewer.load(file,{ style: trackViewer.style3DBlueBackground, domContainer: $('<div></div>')[0], domHeader: null });

		stub.yieldTo('success',fileContent);

		stub.restore();
		add.restore();

		// verify that coords match
		if (count===0)
			expect(add.callCount).to.equal((count+3));			// there are 3 _scene.add(light) lights added at the end
		else
			expect(add.callCount).to.equal((count+3+1));			// there are 3 _scene.add(light) lights added at the end, and one _scene.add(_plane) at the beginning
		//console.log(add.args);
		for (index=0;index<positions.length;index++)
		{
			expect(add.args[index][0].position).deep.to.equal(positions[index]);
		}

		done();
	}

	function test3DMapBoxElevationFromMap(_this,file,count,coordinates,done)
	{
		_this.timeout(30*1000);

		var fileContent=fs.readFileSync(file);

		var stub=sinon.stub(global.jQuery,'ajax');

		var addSource=sinon.spy(mapboxgl.Map.prototype,'addSource');

		trackViewer.load(file,{ style: trackViewer.style3DMapboxStreetMap, elevation: trackViewer.elevationFromMap, domContainer: $('<div></div>')[0], domHeader: null });

		stub.yieldTo('success',fileContent);

		stub.restore();
		addSource.restore();

		// verify that coords match
		var coordinatesCount=0;
		for (var index=1;index<addSource.args.length;index++)
		{
			coordinatesCount+=addSource.args[index][1].data.geometry.coordinates.length;
		}
		expect(coordinatesCount).to.equal(count);
		//console.log(addSource.args[1][1].data.geometry.coordinates);
		for (var index=0;index<coordinates.length;index++)
		{
			expect(addSource.args[1][1].data.geometry.coordinates[index]).deep.to.equal(coordinates[index]);
		}

		done();
	}

	function test3DMapBoxElevationFromFile(_this,file,count,coordinates,done)
	{
		_this.timeout(30*1000);

		var fileContent=fs.readFileSync(file);

		var stub=sinon.stub(global.jQuery,'ajax');

		PathLayerData=[];

		trackViewer.load(file,{ style: trackViewer.style3DMapboxStreetMap, elevation: trackViewer.elevationFromFile, domContainer: $('<div></div>')[0], domHeader: null });

		stub.yieldTo('success',fileContent);

		stub.restore();

		// verify that coords match
		var coordinatesCount=0;
		for (var index=0;index<PathLayerData.length;index++)
		{
			coordinatesCount+=PathLayerData[index].length;
		}
		expect(coordinatesCount).to.equal(count)
		//console.log(PathLayerData);
		for (var index=0;index<coordinates.length;index++)
		{
			expect(PathLayerData[0][index]).deep.to.equal(coordinates[index]);
		}

		done();
	}

	var tracks=		[

							{	file: __dirname+'/test1.kml',			// KML v1
								count: 10771,
								coordinates: [[-158.05954,21.649331],[-158.05952,21.649343]],
								coordinates3D: [[-158.05954,21.649331,425],[-158.05952,21.649343,467.00000762939453]],
								positions: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0.04005 }, { x: 0.0020000000006348273, y: 0.0011999999998124622, z: 0.05750000317891439 }, { x: 0.1471000000009326, y: -0.2898999999999319, z: -0.00875000317891439 }, { x: 0.15050000000087493, y: -0.29479999999999507, z: 0.011666669845581054 }],
								isZip: false,
							},

							{ 	file: __dirname+'/test2.kml',			// KML v2
								count: 211,
								coordinates: [[37.421162,55.979153],[37.42112,55.979187],[37.420788,55.97913]],
								coordinates3D: [[37.421162,55.979153,0],[37.42112,55.979187,0],[37.420788,55.97913,0]],
								positions: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0.04005 }, { x: -0.00420000000005416, y: 0.0034000000006528808, z: 0.04005 }, { x: -0.03740000000007626, y: -0.0022999999998774, z: 0.04005 }],
								isZip: false,
							},

							{ 	file: __dirname+'/test3.kml',			// KML Google My Maps
								count: 2425,
								coordinates: [[-118.39682,33.92155],[-118.39681,33.92106],[-118.39706,33.92106]],
								coordinates3D: [[-118.39682,33.92155,0],[-118.39681,33.92106,0],[-118.39706,33.92106,0]],
								positions: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0.04005 }, { x: 0.0010000000003174137, y: -0.04900000000063187, z: 0.04005 }, { x: -0.023999999999091415, y: -0.04900000000063187, z: 0.04005 }, { x: -0.023999999999091415, y: 0.0019999999999242846, z: 0.04005 }],
								isZip: false,
							},

							{ 	file: __dirname+'/test1.tcx',			// TCX
								count: 18035,
								coordinates: [[19.98199498653412,49.26905357837677],[19.983057975769043,49.269309520721436]],
								coordinates3D: [[19.98199498653412,49.26905357837677,11010.415994055944],[19.983057975769043,49.269309520721436,11006.902174723955]],
								positions: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0.04005 }, { x: 0.10629892349243164, y: 0.025594234466552734, z: 0.03853590861167163 }, { x: 0, y: 0, z: 0.038243090334005955 }],
								isZip: false,
							},

							{	file: __dirname+'/test1.gpx',			// GPX
								count: 307,
								coordinates: [[13.69201667,50.77527167],[13.69196866,50.77523138]],
								coordinates3D: [[13.69201667,50.77527167,7584],[13.69196866,50.77523138,7580]],
								positions: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0.04005 }, { x: -0.004800999999865496, y: -0.004029000000116412, z: 0.03833333333333343 }, { x: -0.0006389999999356633, y: -0.011080000000163182, z: 0.03875000000000019 }],
								isZip: false,
							},

							{	file: __dirname+'/test2.gpx',			// GPX
								count: 14721,
								coordinates: [[9.76586,46.436386],[9.76589,46.436401]],
								coordinates3D: [[9.76586,46.436386,18033.399999999998],[9.76589,46.436401,18035.899999999998]],
								positions: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0.04005 }, { x: 0.0030000000000640625, y: 0.0014999999997655777, z: 0.04104166666666667 }, { x: 0.0037000000000730893, y: 0.0011999999998124622, z: 0.04158333333333379 }],
								isZip: false,
							},

							{	file: __dirname+'/test1.kmz',			// zipped KML v1
								count: 2382,
								coordinates: [[11.450203,50.290867],[11.450252,50.290768]],
								coordinates3D: [[11.450203,50.290867,-99990],[11.450252,50.290768,3888.1638]],
								positions: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0.04005 }, { x: 0.004900000000063187, y: -0.009899999999873899, z: 43.32256825 }, { x: 0.00809999999997757, y: -0.014900000000039881, z: 43.32256825 }],
								isZip: true,
							},
							
							{	file: __dirname+'/test2.kmz',			// zipped KML Google My Maps
								count: 39777,
								coordinates: [[-80.28405,25.80854],[-80.2841,25.80854]],
								coordinates3D: [[-80.28405,25.80854,0],[-80.2841,25.80854,0]],
								positions: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0.04005 }, { x: -0.005000000000165983, y: 0, z: 0.04005 }, { x: -0.01100000000064938, y: -0.0019999999999242846, z: 0.04005 }],
								isZip: true,
							},
							
							{	file: __dirname+'/test1.invalid',	// invalid format
								count: 0,
								coordinates: [],
								coordinates3D: [],
								positions: [],
								isZip: false,
							},

						];

	tracks.forEach(function(track)
	{

		it('should load 2D - '+track.file,function(done)
		{
			test2D(this,track.file,track.count,track.coordinates,done);
		});

		if (track.isZip===false)
		{
			it('should load 2D Blob - '+track.file,function(done)
			{
				test2DBlob(this,track.file,track.count,track.coordinates,done);
			});
		}

		it('should load 3D - '+track.file,function(done)
		{
			test3D(this,track.file,track.count,track.positions,done);
		});

		it('should load 3D MapBox ElevationFromMap- '+track.file,function(done)
		{
			test3DMapBoxElevationFromMap(this,track.file,track.count,track.coordinates,done);
		});

		it('should load 3D MapBox ElevationFromFile - '+track.file,function(done)
		{
			test3DMapBoxElevationFromFile(this,track.file,track.count,track.coordinates3D,done);
		});

	});
		
});

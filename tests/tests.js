const assert=require('assert');
const sinon=require('sinon');
const fs=require('fs');
const chai=require('chai');
const expect=chai.expect;

// create zip
const zip=require('../libs/zip/zip.js');
global.zip=zip;

// create jquery
const { JSDOM } = require('jsdom');
const jsdom = new JSDOM('<!doctype html><html><body></body></html>');
const { window } = jsdom;
global.jQuery=require('jquery')(window);
global.$=global.jQuery;
global.window=window;

// create document
global.document={ getElementById: function(id) { return null; }};

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
}

mapboxgl.FullscreenControl=class FullscreenControl
{
}

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
global.luxon.DateTime={ fromISO: function() { return this; }, setLocale: function() { return this; } };

// create THREE
global.THREE={ };
THREE.ImageUtils={ crossOrigin: '' };
THREE.Scene=class Scene
{
	add(object) { };
}
THREE.FogExp2=class FogExp2
{
}
THREE.PerspectiveCamera=class PerspectiveCamera
{
	position={ set: function() { } }
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
	position={ set: function() { } }
}
THREE.AmbientLight=class AmbientLight
{
}
THREE.WebGLRenderer=class WebGLRenderer
{
	setClearColor() { };
	setPixelRatio() { };
	setSize() { };
	render() { };
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
		var settings={ spacingRight: 10 };
		var jQueryOffset={ left: 6 };

		var spyNull=sinon.spy(	{	height: function(height) { return 2; },
											width: function(width) { return 3; },
											offset: function (offset) { return jQueryOffset; },
											click: function () { }
										});
		$.withArgs(null).returns(spyNull);

		var spyWindow=sinon.spy(	{	height: function(height) { return 4; },
												width: function(width) { return 5; }
											});
		$.withArgs(window).returns(spyWindow);

		// init track viewer
		trackViewer.init(settings);

		assert(global.window.addEventListener.calledOnceWith('resize'));

		assert(spyNull.height.calledOnce);
		expect(spyNull.height.args[0][0]).to.equal(spyWindow.height.returnValues[0])

		assert(spyNull.width.calledOnce);
		expect(spyNull.width.args[0][0]).to.equal((spyWindow.width.returnValues[0] - jQueryOffset.left - settings.spacingRight))
	});
});

describe('Load()',function()
{
	function test2D(_this,file,count,coordinates,done)
	{
		_this.timeout(20*1000);

		global.navigator={ language: 'en' };

		global.google.maps.marker=[];

		var kml=fs.readFileSync(file,'utf8');

		var stub=sinon.stub(global.jQuery,'ajax');

		trackViewer.load(file,{ style: trackViewer.style2DAllRecords, domContainer:null });

		stub.yieldTo('success',kml);

		stub.restore();

		// verify that coords match
//XXX		expect(global.google.maps.marker.length).to.equal(count)
		//console.log(global.google.maps.marker);
		for (index=0;index<coordinates.length;index++)
		{
			expect(global.google.maps.marker[index].position.lat).to.equal(coordinates[index][1])
			expect(global.google.maps.marker[index].position.lng).to.equal(coordinates[index][0])
		}

		done();
	}

	function test3D(_this,file,count,positions,done)
	{
		_this.timeout(20*1000);

		var kml=fs.readFileSync(file,'utf8');

		var stub=sinon.stub(global.jQuery,'ajax');

		var add=sinon.spy(THREE.Scene.prototype,'add');
		
		trackViewer.load(file,{ style: trackViewer.style3DBlueBackground, domContainer: $('<div></div>')[0] });

		stub.yieldTo('success',kml);

		stub.restore();
		add.restore();

		// verify that coords match
		expect(add.callCount).to.equal((count+3+1))		// there are 3 _scene.add(light) lights added at the end, and one _scene.add(_plane) at the beginning
		//console.log(add.args);
		for (index=0;index<positions.length;index++)
		{
			expect(add.args[index][0].position).deep.to.equal(positions[index]);
		}

		done();
	}

	function test3DMapBox(_this,file,count,coordinates,done)
	{
		_this.timeout(20*1000);

		var kml=fs.readFileSync(file,'utf8');

		var stub=sinon.stub(global.jQuery,'ajax');

		var addSource=sinon.spy(mapboxgl.Map.prototype,'addSource');

		trackViewer.load(file,{ style: trackViewer.style3DMapboxStreetMap, domContainer:null });

		stub.yieldTo('success',kml);

		stub.restore();
		addSource.restore();

		// verify that coords match
		expect(addSource.args[1][1].data.geometry.coordinates.length).to.equal(count)
		//console.log(addSource.args[1][1].data.geometry.coordinates);
		for (index=0;index<coordinates.length;index++)
		{
			expect(addSource.args[1][1].data.geometry.coordinates[index]).deep.to.equal(coordinates[index]);
		}

		done();
	}

	var tracks=		[

							{	file: __dirname+'/test1.kml',			// KML v1
								count: 10771,
								coordinates: [[-158.05954,21.649331],[-158.05952,21.649343]],
								positions: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0.04005 }, { x: 0.0020000000006348273, y: 0.0011999999998124622, z: 0.05750000317891439 }, { x: 0.1471000000009326, y: -0.2898999999999319, z: -0.00875000317891439 }, { x: 0.15050000000087493, y: -0.29479999999999507, z: 0.011666669845581054 }]
							},

							{ 	file: __dirname+'/test2.kml',			// Google My Maps
								count: 420,
								coordinates: [[37.421162,55.979153],[37.42112,55.979187],[37.42112,55.979187],[37.420788,55.97913]],
								positions: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0.04005 }, { x: -0.00420000000005416, y: 0.0034000000006528808, z: 0.04005 }, { x: -0.00420000000005416, y: 0.0034000000006528808, z: 0.04005 }, { x: -0.03740000000007626, y: -0.0022999999998774, z: 0.04005 }]
							},
							{ 	file: __dirname+'/test3.kml',			// Google My Maps
								count: 2425,
								coordinates: [[-118.39682,33.92155],[-118.39681,33.92106],[-118.39706,33.92106]],
								positions: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0.04005 }, { x: 0.0010000000003174137, y: -0.04900000000063187, z: 0.04005 }, { x: -0.023999999999091415, y: -0.04900000000063187, z: 0.04005 }, { x: -0.023999999999091415, y: 0.0019999999999242846, z: 0.04005 }]
							},
							{ 	file: __dirname+'/test.tcx',			// TCX
								count: 18035,
								coordinates: [[19.98199498653412,49.26905357837677],[19.983057975769043,49.269309520721436]],
								positions: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0.04005 }, { x: 0.10629892349243164, y: 0.025594234466552734, z: 0.03853590861167163 }, { x: 0, y: 0, z: 0.038243090334005955 }]
							},

							{	file: __dirname+'/test.gpx',			// GPX
								count: 307,
								coordinates: [[13.69201667,50.77527167],[13.69196866,50.77523138]],
								positions: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0.04005 }, { x: -0.004800999999865496, y: -0.004029000000116412, z: 0.03833333333333343 }, { x: -0.0006389999999356633, y: -0.011080000000163182, z: 0.03875000000000019 }]
							},

// xxx kmz files: use real github urls



						];

	tracks.forEach(function(track)
	{
		it('should load 2D - '+track.file,function(done)
		{
			test2D(this,track.file,track.count,track.coordinates,done);
		});

		it('should load 3D - '+track.file,function(done)
		{
			test3D(this,track.file,track.count,track.positions,done);
		});

		it('should load 3D MapBox - '+track.file,function(done)
		{
			test3DMapBox(this,track.file,track.count,track.coordinates,done);
		});

	});
		
});

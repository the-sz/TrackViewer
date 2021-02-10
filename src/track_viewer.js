//
// TrackViewer
//
// Visualize your KML, KMZ, GPX or TCX track in 3D and 2D.
// Rotate, Tilt and Zoom into your track.
// In 2D you can see each recorded position.
// The tooltip will show you the exact time and height.
//
// (c) the-sz.com
//

var trackViewer=(function()
{
	'use strict';

	trackViewer={};

	trackViewer.style3DStreetMap=0;
	trackViewer.style3DSatellite=1;
	trackViewer.style3DBlueBackground=2;
	trackViewer.style3DNoBackground=3;
	trackViewer.style2DAllRecords=4;
	trackViewer.style2DOneRecordPerMinute=5;
	trackViewer.style3DMapboxStreetMap=6;
	trackViewer.style3DMapboxSatellite=7;

	trackViewer.elevationNone=0;
	trackViewer.elevationFromFile=1;
	trackViewer.elevationFromMap=2;

	var _plane=null;
	var _camera=null;
	var _controls=null;
	var _scene=null;
	var _renderer=null;
	var _isFullScreen=false;
	var _lastDate=0;
	var _dots=[];
	var _base;

	// default settings
	var _settings=
	{
		style: trackViewer.style3DMapboxSatellite,
		elevation: trackViewer.elevationFromMap,
		useLines: false,
		useDots: false,
		mapBoxAccessToken: null,
		googleMapsKey: null,
		domContainer: null,
		domHeader: null,
		domFullScreenControl: null,
		domInfo: null,
		spacingRight: 25,
		dotImageLight: 'dotlight.png',
		dotImageLightAnchorX: 8,
		dotImageLightAnchorY: 8,
		dotImageHeavy: 'dotheavy.png',
		dotImageHeavyAnchorX: 13,
		dotImageHeavyAnchorY: 13,
		lineColor2D: '#0776FF',
		lineColor3DMapBoxElevationFromMap: 'rgba(4, 117, 255, 1.0)',
		lineColor3DMapBoxElevationFromFile: [4, 117, 255, 255],
		zipLibraryLocation: '../libs/zip/',
	}

	// init basics
	trackViewer.init=function (settings)
	{
		// copy settings
		for (var setting in settings)
		{
			_settings[setting]=settings[setting];
		}

		window.addEventListener('resize',_onWindowResize,false);
		_onWindowResize();

		$(_settings.domFullScreenControl).click(function()
		{
			_setFullScreen(!_isFullScreen);
		});
	}

	// load track file and adjust settings
	trackViewer.load=function (file,settings)
	{
		// copy settings
		for (var setting in settings)
		{
			_settings[setting]=settings[setting];
		}

		if (typeof file=='string')
		{
			// load specified remote file
			$.ajax(
			{
				url: file,
				type: 'GET',
				xhrFields: { responseType: 'arraybuffer' },
				processData: false,
				success: function(data)
				{
					if (file.split('.').pop()=='kmz')
					{
						// compressed remote file was specified, extract it first
						zip.workerScriptsPath=_settings.zipLibraryLocation;
						zip.createReader(new zip.TextReader(data),function(reader)
						{
							reader.getEntries(function(entries)
							{
								if (entries.length>0)
								{
									entries[0].getData(new zip.TextWriter(),function(text)
									{
										_load($.parseXML(text));

										reader.close(function()
										{
										});
									});
								}
							});
						});
					}
					else
					{
						// remote file
						_load($.parseXML(data));
					}
				}
			});
		}
		else if (file.name.split('.').pop()=='kmz')
		{
			// local compressed file was specified, extract it first
			zip.workerScriptsPath=_settings.zipLibraryLocation;
			zip.createReader(new zip.BlobReader(file),function(reader)
			{
				reader.getEntries(function(entries)
				{
					if (entries.length>0)
					{
						entries[0].getData(new zip.TextWriter(),function(text)
						{
							_load($.parseXML(text));

							reader.close(function()
							{
							});
						});
					}
				});
			});
		}
		else
		{
			// load specified local file
			var reader=new FileReader();
			reader.onload=function(event)
			{
				_load($.parseXML(event.target.result));
			};

			reader.readAsText(file);
		}
	}

	// unload all stuff
	function _unload()
	{
		_plane=null;
		_camera=null;
		_controls=null;
		_scene=null;
		_renderer=null;

		$(_settings.domContainer).empty();

		$(_settings.domFullScreenControl).css('display','none');
	}

	// on window resize, resize our container too
	function _onWindowResize()
	{
		if (_isFullScreen==true)
		{
			// full screen
			$(_settings.domContainer).height($(window).height());
			$(_settings.domContainer).width($(window).width());
		}
		else
		{
			// set container to window size
			var headerHeight=0;
			if (_settings.domHeader!=null)
				headerHeight=$(_settings.domHeader).height();

			$(_settings.domContainer).height($(window).height() - headerHeight);
			$(_settings.domContainer).width($(window).width() - $(_settings.domContainer).offset().left - _settings.spacingRight);
		}

		if (_camera!=null)
		{
			_camera.aspect=$(_settings.domContainer).innerWidth() / $(_settings.domContainer).innerHeight();
			_camera.updateProjectionMatrix();
		}

		if (_renderer!=null)
			_renderer.setSize($(_settings.domContainer).innerWidth(),$(_settings.domContainer).innerHeight());

		_render3D();
	}

	// set full screen or not full screen
	function _setFullScreen(fullScreen)
	{
		_isFullScreen=fullScreen;
		
		if (_isFullScreen==true)
		{
			// set container to full screen
			$(_settings.domContainer).css('left',0);
			$(_settings.domContainer).css('right',0);
			$(_settings.domContainer).css('top',0);
			$(_settings.domContainer).css('bottom',0);
			$(_settings.domContainer).css('position','absolute');
			$('body').css('overflow','hidden');
			$(_settings.domFullScreenControl).addClass('fullscreen');
		}
		else
		{
			// set container to non-full screen
			$(_settings.domContainer).css('left','');
			$(_settings.domContainer).css('right','');
			$(_settings.domContainer).css('top','');
			$(_settings.domContainer).css('bottom','');
			$(_settings.domContainer).css('position','');
			$('body').css('overflow','');
			$(_settings.domFullScreenControl).removeClass('fullscreen');
		}

		_onWindowResize();
	}

	// load track
	function _load(data)
	{
		_unload();

		$(_settings.domInfo).css('display','none');

		$(_settings.domContainer).css('display','block', 'important');

		if ((_settings.style==trackViewer.style2DAllRecords) || (_settings.style==trackViewer.style2DOneRecordPerMinute))
		{
			// 2D
			_load2D(data);
		}
		else if ((_settings.style==trackViewer.style3DMapboxStreetMap) || (_settings.style==trackViewer.style3DMapboxSatellite))
		{
			// 3D mapbox
			_load3DMapbox(data);
		}
		else
		{
			// 3D
			$(_settings.domFullScreenControl).css('display','block');
			_load3D(data);
		}
	}

	// create a 2D marker
	function _create2DMarker(map,date,position,title)
	{
		// allow marker only every minute
		if ((_settings.style==trackViewer.style2DAllRecords) || ((date-_lastDate)>(60*1000)))
		{
			_lastDate=date;

			if (_settings.style==trackViewer.style2DAllRecords)
				var icon={ url: _settings.dotImageLight, anchor: new google.maps.Point(_settings.dotImageLightAnchorX, _settings.dotImageLightAnchorY) };
			else
				var icon={ url: _settings.dotImageHeavy, anchor: new google.maps.Point(_settings.dotImageHeavyAnchorX, _settings.dotImageHeavyAnchorY) };
			new google.maps.Marker({position:position, map:map, title:title, icon:icon });

			_dots.push(position);
		}
	}

	// load track and display in 2D
	function _load2D(data)
	{
		var center;
		var userLang=navigator.language || navigator.userLanguage;
		var map=new google.maps.Map(document.getElementById('container'),{ zoom:7, gestureHandling: 'greedy' });

		_dots=[];

		_lastDate=0;

		// tcx format
		$(data).find('Track').children().each(function(index)
		{
			var date=new Date($(this).children('Time').text());
			var dateString=luxon.DateTime.fromISO($(this).children('Time').text(), { setZone: true }).setLocale(userLang).toLocaleString(luxon.DateTime.DATETIME_SHORT);

			var title=dateString+' - Height: '+parseFloat($(this).children('AltitudeMeters').text()).toFixed(0)+'m - Heart Rate: '+parseFloat($(this).children('HeartRateBpm').children('Value').text()).toFixed(0)+'bpm - Distance: '+parseFloat($(this).children('DistanceMeters').text()).toFixed(0)+'m';
			var position={lat:parseFloat($(this).children('Position').children('LatitudeDegrees').text()), lng:parseFloat($(this).children('Position').children('LongitudeDegrees').text())};

			_create2DMarker(map,date,position,title);

			if (center===undefined)
				center=position;
		});

		// gpx format
		$(data).find('trk').find('trkseg').children().each(function(index)
		{
			var date=new Date($(this).children('time').text());
			var dateString=luxon.DateTime.fromISO($(this).children('time').text(), { setZone: true }).setLocale(userLang).toLocaleString(luxon.DateTime.DATETIME_SHORT);

			var title=dateString+' - Height: '+parseFloat($(this).children('ele').text()).toFixed(0)+'m';
			var position={lat:parseFloat($(this)[0].attributes.lat.value), lng:parseFloat($(this)[0].attributes.lon.value)};

			_create2DMarker(map,date,position,title);

			if (center===undefined)
				center=position;
		});

		// kml format
		var coordinates=$(data).find('gx\\:coord');
		var index=0;
		$(data).find('when').each(function()
		{
			var date=new Date($(this).text());
			var dateString=luxon.DateTime.fromISO($(this).text(), { setZone: true }).setLocale(userLang).toLocaleString(luxon.DateTime.DATETIME_SHORT);

			// format 1
			var values=$($(coordinates)[index]).text().split(' ');
			if (values.length!=3)
			{
				// format 2
				values=$(this).parent().parent().children('Point').children('coordinates').text().split(',');
			}

			if (values.length==3)
			{
				var title=dateString+' - Height: '+parseFloat(values[2]).toFixed(0)+'m';
				var position={lat:parseFloat(values[1]), lng:parseFloat(values[0])};

				_create2DMarker(map,date,position,title);

				if (center===undefined)
					center=position;
			}

			index++;
		});

		// kml my maps format
		var date=new Date();
		$(data).find('LineString').find('coordinates').each(function()
		{
			var name=$(this).parent().parent().children('name').text();
			var values=$(this).text().split(' ');
			$(values).each(function()
			{
				var parts=this.split(',');
				if (parts.length==3)
				{
					var title=name+' - Height: '+parseFloat(parts[2]).toFixed(0)+'m';
					var position={lat:parseFloat(parts[1]), lng:parseFloat(parts[0])};

					// since we don't have a date, show always all dots
					_create2DMarker(map,date,position,title,((_settings.style!=trackViewer.style2DOneRecordPerMinute)?_settings.style:trackViewer.style2DAllRecords));
		
					if (center===undefined)
						center=position;
				}
			});
		});

		// create line
		if (_settings.useLines==true)
			new google.maps.Polyline({ path: _dots, geodesic: false, strokeColor: _settings.lineColor2D, strokeOpacity: 0.5, strokeWeight: 2, map: map });

		if (center!==undefined)
			map.setCenter(center);
	}

	// load track and display in 3D
	function _load3D(data)
	{
		var radius=0.01;

		var geometry;
		var initial=true;

		_scene=new THREE.Scene();

		// no fog
		_scene.fog=new THREE.FogExp2(0x000000,0);

		// camera
		_camera=new THREE.PerspectiveCamera(40,window.innerWidth / window.innerHeight,0.1,10000);
		_camera.position.set(0,-150,150);
		// top is up
		_camera.up=new THREE.Vector3(0,0,1);

		// create the display objects
		if (_settings.useDots==true)
			geometry=new THREE.DodecahedronGeometry(radius,2);
		else
			geometry=new THREE.CylinderGeometry(radius,radius,1,10,1);

		var material=new THREE.MeshLambertMaterial( { color:0xff0000, flatShading:true } );

		// add all kml coordinates to our space
		var nodes;
		var isTCX=false;
		var isGPX=false;
		var isKML2=false;
		var isMyMaps=false;

		nodes=$(data).find('coord');
		if (nodes.length==0)
		{
			nodes=$(data).find('gx\\:coord');
			if (nodes.length==0)
			{
				var nodesCoordinates=$(data).find('LineString').find('coordinates');
				if (nodesCoordinates.length>0)
				{
					// kml my maps format
					nodes=[];
					$(nodesCoordinates).each(function()
					{
						$($(this).text().split(' ')).each(function()
						{
							nodes.push(this);
						});
					});
					isMyMaps=true;
				}
				else
				{
					nodes=$(data).find('Folder').children();
					if (nodes.length>0)
					{
						isKML2=true;
					}
					else
					{
						nodes=$(data).find('trk').find('trkseg').children();
						if (nodes.length>0)
						{
							isGPX=true;
						}
						else
						{
							nodes=$(data).find('Trackpoint');
							isTCX=true;
						}
					}
				}
			}
		}
		$(nodes).each(function()
		{
			var position=new Object();
			var valid=false;

			if (isTCX==true)
			{
				position.x=$(this).children('Position').children('LongitudeDegrees').text();
				position.y=$(this).children('Position').children('LatitudeDegrees').text();
				position.z=$(this).children('AltitudeMeters').text();
				valid=true;
			}
			else if (isGPX==true)
			{
				position.x=$(this)[0].attributes.lon.value;
				position.y=$(this)[0].attributes.lat.value;
				position.z=$(this).children('ele').text();
				valid=true;
			}
			else if (isKML2==true)
			{
				var values=$(this).children('Point').children('coordinates').text().split(',');
				position.x=values[0];
				position.y=values[1];
				position.z=values[2];
				if (values.length==3)
					valid=true;
			}
			else if (isMyMaps==true)
			{
				var parts=this.split(",");
				if (parts.length==3)
				{
					position.x=parseFloat(parts[0]);
					position.y=parseFloat(parts[1]);
					position.z=parseFloat(parts[2]);
					valid=true;
				}
			}
			else
			{
				var values=$(this).text().split(' ');
				position.x=values[0];
				position.y=values[1];
				position.z=values[2];
				if (values.length==3)
					valid=true;
			}
			if (valid==true)
			{
				if (initial==true)
				{
					// save start position as base
					_base=position;
					initial=false;
		
					// add earth surface
					var earthSize=300;
					var maptype=null;
					var planeMaterial=null;
					var planeGeometry=new THREE.PlaneBufferGeometry(earthSize,earthSize);
					THREE.ImageUtils.crossOrigin='';
					if (_settings.style==trackViewer.style3DStreetMap)
						maptype='roadmap';
					else if (_settings.style==trackViewer.style3DSatellite)
						maptype='satellite';
					else if (_settings.style==trackViewer.style3DBlueBackground)
					{
						planeMaterial=new THREE.MeshPhongMaterial( { color: 0x0040F0, side: THREE.DoubleSide } );
					}
					if (maptype!=null)
					{
						var texture=THREE.ImageUtils.loadTexture(('http://maps.google.com/maps/api/staticmap?center='+_base.y+','+_base.x+'&zoom=8&size=640x640&maptype='+maptype+'&scale=2&key='+_settings.googleMapsKey),undefined,function() { _render3D(); });
						texture.minFilter=THREE.LinearFilter;
						planeMaterial=new THREE.MeshPhongMaterial( { map: texture, side: THREE.DoubleSide } );
					}
					if (planeMaterial!=null)
					{
						_plane=new THREE.Mesh(planeGeometry,planeMaterial);
						_scene.add(_plane);
					}
				}
		
				var mesh=new THREE.Mesh(geometry,material);
		
				if (_settings.useDots==true)
				{
					// create dot
					mesh.position.x=(position.x-_base.x)*100;
					mesh.position.y=(position.y-_base.y)*100;
					mesh.position.z=(position.z-_base.z)/120;
				}
				else
				{
					// create cylinder
					var height=(position.z-_base.z)/120;
					var z=0;
					if (height<0)
					{
						// if height is below 0, move cylinder down
						height=-height;
						z=-height;
					}
					else if (height==0)
						height=0.0001;
		
					// rotate up
					mesh.rotateOnAxis((new THREE.Vector3(1,0,0)).normalize(),(Math.PI/2));
					// set height
					mesh.scale.y=height;
					mesh.position.x=(position.x-_base.x)*100;
					mesh.position.y=(position.y-_base.y)*100;
					mesh.position.z=(height/2)+z+0.04;				// move the cylinder a little bit up to prevent drawing errors
				}
		
				mesh.updateMatrix();
				mesh.matrixAutoUpdate=false;
				_scene.add(mesh);
			}
		});

		// create key/mouse handling
		_controls=new THREE.OrbitControls(_camera,_settings.domContainer,_plane,_render3D);
		_controls.addEventListener('change',_render3D);

		// lights
		var light=new THREE.DirectionalLight(0x808080);
		light.position.set(1,-1,1);
		_scene.add(light);
		light=new THREE.DirectionalLight(0x808080);
		light.position.set(-1,1,1);
		_scene.add(light);
		light=new THREE.AmbientLight(0x222222);
		_scene.add(light);

		// renderer
		_renderer=new THREE.WebGLRenderer( { antialias: true } );
		_renderer.setClearColor(_scene.fog.color);
		_renderer.setPixelRatio(window.devicePixelRatio);
		_renderer.setSize($(_settings.domContainer).innerWidth(),$(_settings.domContainer).innerHeight());

		_settings.domContainer.appendChild(_renderer.domElement);

		_render3D();
	}

	// render function for 3D
	function _render3D()
	{
		if (_renderer!=null)
			_renderer.render(_scene,_camera);
	}

	// load track and display in 3D mapbox
	function _load3DMapbox(data)
	{
		var initial=true;

		// add all kml coordinates to data array
		var nodes;
		var dataPoints;
		var isTCX=false;
		var isGPX=false;
		var isKML2=false;
		var isMyMaps=false;

		if ((_settings.elevation==trackViewer.elevationFromMap) || (_settings.elevation==trackViewer.elevationNone))
			dataPoints=[];
		else
			dataPoints=[ { 'path': [] } ];

		nodes=$(data).find('coord');
		if (nodes.length==0)
		{
			nodes=$(data).find('gx\\:coord');
			if (nodes.length==0)
			{
				var nodesCoordinates=$(data).find('LineString').find('coordinates');
				if (nodesCoordinates.length>0)
				{
					// kml my maps format
					nodes=[];
					$(nodesCoordinates).each(function()
					{
						$($(this).text().split(' ')).each(function()
						{
							nodes.push(this);
						});
					});
					isMyMaps=true;
				}
				else
				{
					nodes=$(data).find('Folder').children();
					if (nodes.length>0)
					{
						isKML2=true;
					}
					else
					{
						nodes=$(data).find('trk').find('trkseg').children();
						if (nodes.length>0)
						{
							isGPX=true;
						}
						else
						{
							nodes=$(data).find('Trackpoint');
							isTCX=true;
						}
					}
				}
			}
		}
		$(nodes).each(function()
		{
			var position=new Object();
			var valid=false;

			if (isTCX==true)
			{
				position.x=$(this).children('Position').children('LongitudeDegrees').text();
				position.y=$(this).children('Position').children('LatitudeDegrees').text();
				position.z=$(this).children('AltitudeMeters').text();
				valid=true;
			}
			else if (isGPX==true)
			{
				position.x=$(this)[0].attributes.lon.value;
				position.y=$(this)[0].attributes.lat.value;
				position.z=$(this).children('ele').text();
				valid=true;
			}
			else if (isKML2==true)
			{
				var values=$(this).children('Point').children('coordinates').text().split(',');
				position.x=values[0];
				position.y=values[1];
				position.z=values[2];
				if (values.length==3)
					valid=true;
			}
			else if (isMyMaps==true)
			{
				var parts=this.split(",");
				if (parts.length==3)
				{
					position.x=parseFloat(parts[0]);
					position.y=parseFloat(parts[1]);
					position.z=parseFloat(parts[2]);
					valid=true;
				}
			}
			else
			{
				var values=$(this).text().split(' ');
				position.x=values[0];
				position.y=values[1];
				position.z=values[2];
				if (values.length==3)
					valid=true;
			}
			if (valid==true)
			{
				if (initial==true)
				{
					// save start position as base
					_base=position;
					initial=false;
				}

				if ((_settings.elevation==trackViewer.elevationFromMap) || (_settings.elevation==trackViewer.elevationNone))
					dataPoints.push([parseFloat(position.x), parseFloat(position.y)]);
				else
					dataPoints[0].path.push([parseFloat(position.x), parseFloat(position.y), parseFloat(position.z)*10]);
			}
		});

		if ((_settings.elevation==trackViewer.elevationFromMap) || (_settings.elevation==trackViewer.elevationNone))
		{
			// mapbox
			mapboxgl.accessToken=_settings.mapBoxAccessToken;
			var map=new mapboxgl.Map(
			{
				container: 'container',
				zoom: 8,
				center: [parseFloat(_base.x), parseFloat(_base.y)],
				pitch: 50,
				bearing: 0,
				style: (_settings.style==trackViewer.style3DMapboxStreetMap)?'mapbox://styles/mapbox/streets-v11':'mapbox://styles/mapbox/satellite-streets-v11',
			});

			map.on('load', function ()
			{
				map.addSource('mapbox-dem',
				{
					'type': 'raster-dem',
					'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
					'tileSize': 512,
					'maxzoom': 14
				});

				if (_settings.elevation==trackViewer.elevationFromMap)
					map.setTerrain({ 'source': 'mapbox-dem', 'exaggeration': 1.5 });

				map.addControl(new mapboxgl.FullscreenControl());

				map.addLayer(
				{
					'id': 'sky',
					'type': 'sky',
					'paint':
					{
						'sky-type': 'atmosphere',
						'sky-atmosphere-color': 'rgba(34,88,176,1.0)',
						'sky-atmosphere-halo-color': 'rgba(176,215,255,1.0)',
						'sky-atmosphere-sun': [0.0, 50.0],
						'sky-atmosphere-sun-intensity': 10
					}
				});

				map.addSource('trace',
				{
					type: 'geojson',
					data:
					{
						'type': 'Feature',
						'properties': {},
						'geometry': {
						'type': 'LineString',
						'coordinates': dataPoints
					}
					}
				});

				map.addLayer(
				{
					type: 'line',
					source: 'trace',
					id: 'line',
					paint:
					{
						'line-color': _settings.lineColor3DMapBoxElevationFromMap,
						'line-width': 3
					},
					layout:
					{
						'line-cap': 'round',
						'line-join': 'round'
					}
				});
			});
		}
		else
		{
			// mapbox using deck gl for elevation
			const {DeckGL, PathLayer}=deck;

			new DeckGL(
			{
				container: _settings.domContainer,
				mapboxApiAccessToken: _settings.mapBoxAccessToken,
				// https://docs.mapbox.com/mapbox-gl-js/api/
				mapStyle: (_settings.style==trackViewer.style3DMapboxStreetMap)?'mapbox://styles/mapbox/streets-v11':'mapbox://styles/mapbox/satellite-streets-v11',
				initialViewState:
				{
					latitude: parseFloat(_base.y),
					longitude: parseFloat(_base.x),
					zoom: 8,
					pitch: 50,
					bearing: 0
				},
				controller: true,
				layers:
				[
					new PathLayer(
					{
						data: dataPoints,
						billboard: true,
						widthScale: 1,
						widthMinPixels: 2,
						widthMaxPixels: 10,
						getColor: d => _settings.lineColor3DMapBoxElevationFromFile,
						getWidth: d => 1,
					})
				]
			});
		}
	}

	return trackViewer;

}.call(this));

if ((typeof module==="object") && (typeof module.exports==="object"))
{
	module.exports=trackViewer;
}

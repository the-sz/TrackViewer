//
// TrackViewer
//
// https://github.com/the-sz/TrackViewer
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
		spacingRight: 5,
		dotImageLight: 'dotlight.png',
		dotImageLightAnchorX: 8,
		dotImageLightAnchorY: 8,
		dotImageHeavy: 'dotheavy.png',
		dotImageHeavyAnchorX: 13,
		dotImageHeavyAnchorY: 13,
		lineColor2D: '#0776FF',
		lineColor3DMapBoxElevationFromMap: 'rgba(4, 117, 255, 1.0)',
		lineColor3DMapBoxElevationFromFile: [4, 117, 255, 255],
	};

	// init basics
	trackViewer.init=function(settings)
	{
		// copy settings
		for (var setting in settings)
		{
			if (_settings.hasOwnProperty(setting))
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
	trackViewer.load=function(file,settings)
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
					if (file.split('.').pop()==='kmz')
					{
						// remote compressed file, extract it first
						if ((typeof module==='object') && (typeof module.exports==='object'))
						{
							// running in node.js
							var zip=new JSZip(data,{ base64: false, checkCRC32: true });
							var content=zip.files['doc.kml'];
							_load($.parseXML(content._data));
						}
						else
						{
							// running in browser
							JSZip.loadAsync(data).then(function(zip)
							{
								zip.file('doc.kml').async('string').then(function(content)
								{
									_load($.parseXML(content));
								});
							});
						}
					}
					else
					{
						// remote file
						_load($.parseXML(new TextDecoder('utf-8').decode(data)));
					}
				}
			});
		}
		else if (file.name.split('.').pop()==='kmz')
		{
			// local compressed file, extract it first
			JSZip.loadAsync(file).then(function (zip)
			{
				zip.file('doc.kml').async('string').then(function(content)
				{
					_load($.parseXML(content));
				});
			});
		}
		else
		{
			// local file
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
		if (_isFullScreen===true)
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
			$(_settings.domContainer).addClass('fullscreen');
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
			$(_settings.domContainer).removeClass('fullscreen');
		}

		_onWindowResize();
	}

	// load track
	function _load(data)
	{
		_unload();

		$(_settings.domInfo).css('display','none');

		$(_settings.domContainer).css('display','block', 'important');

		if ((_settings.style===trackViewer.style2DAllRecords) || (_settings.style===trackViewer.style2DOneRecordPerMinute))
		{
			// 2D
			_load2D(data);
		}
		else if ((_settings.style===trackViewer.style3DMapboxStreetMap) || (_settings.style===trackViewer.style3DMapboxSatellite))
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

		_onWindowResize();
	}

	// convert all suppored track formats into one position list
	function _parseTrack(data)
	{
		var nodes;
		var tracks=[];
		var allPositions=[];
		var isTCX=false;
		var isGPX=false;
		var isKML2=false;
		var isMyMaps=false;
		var userLang=navigator.language || navigator.userLanguage;
		var coordinates=[];

		for (;;)
		{
			nodes=$(data).find('coord');
			if (nodes.length>0)
			{
				// KML v1
				//console.log('KML v1');
				coordinates.push(nodes);
				tracks.push($(data).find('when'));
				break;
			}

			nodes=$(data).find('gx\\:coord');
			if (nodes.length>0)
			{
				// KML v1
				//console.log('KML v1');
				coordinates.push(nodes);
				tracks.push($(data).find('when'));
				break;
			}

			var nodesCoordinates=$(data).find('Placemark').children('LineString').children('coordinates');
			if (nodesCoordinates.length>0)
			{
				// KML Google My Maps
				nodes=[];
				$(nodesCoordinates).each(function()
				{
					var name=escape($(this).parent().parent().children('name').text());

					$($(this).text().split(' ')).each(function()					// lgtm [js/xss-through-dom]
					{
						var parts=this.split(',');
						if (parts.length===3)
						{
							parts.push(name);
							nodes.push(parts);
						}
					});
				});
				//console.log('KML Google My Maps');
				tracks.push(nodes);
				isMyMaps=true;
				break;
			}

			nodes=$(data).find('Folder').children();
			if (nodes.length>0)
			{
				// KML v2
				//console.log('KML v2');
				tracks.push(nodes);
				isKML2=true;
				break;
			}

			nodes=$(data).find('trk');
			if (nodes.length>0)
			{
				// GPX
				//console.log('GPX');
				$(nodes).each(function()
				{
					tracks.push($(this).find('trkseg').children());
				});
				isGPX=true;
				break;
			}

			nodes=$(data).find('Trackpoint');
			if (nodes.length>0)
			{
				// TCX
				//console.log('TCX');
				tracks.push(nodes);
				isTCX=true;
				break;
			}

			break;
		}

		var track=0;
		$(tracks).each(function()
		{
			var index=0;
			var positions=[];
			$(this).each(function()
			{
				var position={};
				var valid=false;

				if (isTCX===true)
				{
					// TCX
					position.x=parseFloat($(this).children('Position').children('LongitudeDegrees').text());
					position.y=parseFloat($(this).children('Position').children('LatitudeDegrees').text());
					position.z=parseFloat($(this).children('AltitudeMeters').text());

					position.date=new Date($(this).children('Time').text());
					var dateString=luxon.DateTime.fromISO($(this).children('Time').text(), { setZone: true }).setLocale(userLang).toLocaleString(luxon.DateTime.DATETIME_SHORT);
					position.title=dateString+' - Height: '+position.z.toFixed(0)+'m - Heart Rate: '+parseFloat($(this).children('HeartRateBpm').children('Value').text()).toFixed(0)+'bpm - Distance: '+parseFloat($(this).children('DistanceMeters').text()).toFixed(0)+'m';

					valid=true;
				}
				else if (isGPX===true)
				{
					// GPX
					position.x=parseFloat($(this)[0].attributes.lon.value);
					position.y=parseFloat($(this)[0].attributes.lat.value);
					position.z=parseFloat($(this).children('ele').text());

					var date=$(this).children('time').text();
					if (date!='')
					{
						position.date=new Date(date);
						var dateString=luxon.DateTime.fromISO(date, { setZone: true }).setLocale(userLang).toLocaleString(luxon.DateTime.DATETIME_SHORT);
						position.title=dateString+' - Height: '+position.z.toFixed(0)+'m';
					}
					else
					{
						position.date=new Date();
						position.title='Height: '+position.z.toFixed(0)+'m';
					}
		
					valid=true;
				}
				else if (isKML2===true)
				{
					// KML v2
					var values=$(this).children('Point').children('coordinates').text().split(',');
					if (values.length===3)
					{
						position.x=parseFloat(values[0]);
						position.y=parseFloat(values[1]);
						position.z=parseFloat(values[2]);

						var dateRaw=$(this).children('TimeStamp').children('when').text();
						position.date=new Date(dateRaw);
						var dateString=luxon.DateTime.fromISO(dateRaw, { setZone: true }).setLocale(userLang).toLocaleString(luxon.DateTime.DATETIME_SHORT);
						position.title=dateString+' - Height: '+position.z.toFixed(0)+'m';

						valid=true;
					}
				}
				else if (isMyMaps===true)
				{
					// KML Google My Maps
					position.x=parseFloat(this[0]);
					position.y=parseFloat(this[1]);
					position.z=parseFloat(this[2]);

					position.date=new Date();
					position.title=this[3]+' - Height: '+position.z.toFixed(0)+'m';

					valid=true;
				}
				else
				{
					// KML v1
					// this is 'when'
					// coordinates are then coords
					var values=$($(coordinates[track])[index]).text().split(' ');
					if (values.length==3)
					{
						position.x=parseFloat(values[0]);
						position.y=parseFloat(values[1]);
						position.z=parseFloat(values[2]);

						position.date=new Date($(this).text());
						var dateString=luxon.DateTime.fromISO($(this).text(), { setZone: true }).setLocale(userLang).toLocaleString(luxon.DateTime.DATETIME_SHORT);
						position.title=dateString+' - Height: '+position.z.toFixed(0)+'m';

						valid=true;
					}
				}
				if (valid===true)
				{
					positions.push(position);
				}

				index++;
			});

			allPositions.push(positions);

			track++;
		});

		return allPositions;
	}

	// create a 2D marker
	function _create2DMarker(map,date,position,title)
	{
		// allow marker only every minute
		if ((_settings.style===trackViewer.style2DAllRecords) || ((date-_lastDate)>(60*1000)))
		{
			_lastDate=date;

			if (_settings.style===trackViewer.style2DAllRecords)
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
		var map=new google.maps.Map(_settings.domContainer,{ zoom:7, gestureHandling: 'greedy' });

		_lastDate=0;

		// create 2d marker for all positions
		var positions=_parseTrack(data);
		$(positions).each(function()
		{
			_dots=[];
			$(this).each(function()
			{
				var position={lat:this.y, lng:this.x};

				_create2DMarker(map,this.date,position,this.title);

				if (center===undefined)
					center=position;
			});

			// create line
			if (_settings.useLines===true)
				new google.maps.Polyline({ path: _dots, geodesic: false, strokeColor: _settings.lineColor2D, strokeOpacity: 0.5, strokeWeight: 2, map: map });
		});

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
		if (_settings.useDots===true)
			geometry=new THREE.DodecahedronGeometry(radius,2);
		else
			geometry=new THREE.CylinderGeometry(radius,radius,1,10,1);

		var material=new THREE.MeshLambertMaterial( { color:0xFF0000, flatShading:true } );

		// add all coordinates to our space
		var positions=_parseTrack(data);
		$(positions).each(function()
		{
			$(this).each(function()
			{
				if (initial===true)
				{
					// save start position as base
					_base=this;
					initial=false;
		
					// add earth surface
					var earthSize=300;
					var maptype=null;
					var planeMaterial=null;
					var planeGeometry=new THREE.PlaneBufferGeometry(earthSize,earthSize);
					THREE.ImageUtils.crossOrigin='';
					if (_settings.style===trackViewer.style3DStreetMap)
						maptype='roadmap';
					else if (_settings.style===trackViewer.style3DSatellite)
						maptype='satellite';
					else if (_settings.style===trackViewer.style3DBlueBackground)
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
		
				if (_settings.useDots===true)
				{
					// create dot
					mesh.position.x=(this.x-_base.x)*100;
					mesh.position.y=(this.y-_base.y)*100;
					mesh.position.z=(this.z-_base.z)/120;
				}
				else
				{
					// create cylinder
					var height=(this.z-_base.z)/120;
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
					mesh.position.x=(this.x-_base.x)*100;
					mesh.position.y=(this.y-_base.y)*100;
					mesh.position.z=(height/2)+z+0.04;				// move the cylinder a little bit up to prevent drawing errors
				}
		
				mesh.updateMatrix();
				mesh.matrixAutoUpdate=false;
				_scene.add(mesh);
			});
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
		var dataPoints=[];
		var bounds;
		var initial=true;
		var index;

		// add all coordinates to data array
		var positions=_parseTrack(data);
		index=0;
		$(positions).each(function()
		{
			if ((_settings.elevation==trackViewer.elevationFromMap) || (_settings.elevation==trackViewer.elevationNone))
				dataPoints.push([]);
			else
				dataPoints.push([ { 'path': [] } ]);

			$(this).each(function()
			{
				if (initial==true)
				{
					// save start position as base
					_base=this;
					initial=false;

					bounds=new mapboxgl.LngLatBounds([parseFloat(this.x), parseFloat(this.y)],[parseFloat(this.x), parseFloat(this.y)]);
				}

				if ((_settings.elevation==trackViewer.elevationFromMap) || (_settings.elevation==trackViewer.elevationNone))
					dataPoints[index].push([parseFloat(this.x), parseFloat(this.y)]);
				else
					dataPoints[index][0].path.push([parseFloat(this.x), parseFloat(this.y), parseFloat(this.z)*10]);

				bounds.extend([parseFloat(this.x), parseFloat(this.y)]);
			});

			index++;
		});

		if ((_settings.elevation==trackViewer.elevationFromMap) || (_settings.elevation==trackViewer.elevationNone))
		{
			// mapbox
			mapboxgl.accessToken=_settings.mapBoxAccessToken;

			var map=new mapboxgl.Map(
			{
				container: _settings.domContainer,
				zoom: 8,
				center: [parseFloat(_base.x), parseFloat(_base.y)],
				pitch: 50,
				bearing: 0,
				bounds: bounds,
				fitBoundsOptions: { padding: 0 },
				style: (_settings.style===trackViewer.style3DMapboxStreetMap)?'mapbox://styles/mapbox/streets-v11':'mapbox://styles/mapbox/satellite-streets-v11',
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

				index=0;
				$(dataPoints).each(function()
				{
					map.addSource('trace_'+index,
					{
						type: 'geojson',
						data:
						{
							'type': 'Feature',
							'properties': {},
							'geometry':
							{
								'type': 'LineString',
								'coordinates': this
							}
						}
					});

					map.addLayer(
					{
						type: 'line',
						source: 'trace_'+index,
						id: 'line_'+index,
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

					index++;
				});
			});
		}
		else
		{
			// mapbox using deck gl for elevation
			const {DeckGL, PathLayer}=deck;

			var layers=[];
			index=0;
			$(dataPoints).each(function()
			{
				layers.push(new PathLayer(
					{
						id: 'layer_'+index,
						data: this,
						billboard: true,
						widthScale: 1,
						widthMinPixels: 2,
						widthMaxPixels: 10,
						getColor: d => _settings.lineColor3DMapBoxElevationFromFile,
						getWidth: d => 1,
					}
				));

				index++;
			});

			new DeckGL(
			{
				container: _settings.domContainer,
				mapboxApiAccessToken: _settings.mapBoxAccessToken,
				// https://docs.mapbox.com/mapbox-gl-js/api/
				mapStyle: (_settings.style===trackViewer.style3DMapboxStreetMap)?'mapbox://styles/mapbox/streets-v11':'mapbox://styles/mapbox/satellite-streets-v11',
				initialViewState:
				{
					latitude: parseFloat(_base.y),
					longitude: parseFloat(_base.x),
					zoom: 8,
					pitch: 50,
					bearing: 0
				},
				controller: true,
				layers: layers,
			});
		}
	}

	return trackViewer;

}.call(this));

if ((typeof module==='object') && (typeof module.exports==='object'))
{
	module.exports=trackViewer;
}

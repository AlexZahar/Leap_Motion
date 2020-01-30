<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>JSDoc: Source: maincontroller.js</title>

    <script src="scripts/prettify/prettify.js"> </script>
    <script src="scripts/prettify/lang-css.js"> </script>
    <!--[if lt IE 9]>
      <script src="//html5shiv.googlecode.com/svn/trunk/html5.js"></script>
    <![endif]-->
    <link type="text/css" rel="stylesheet" href="styles/prettify-tomorrow.css">
    <link type="text/css" rel="stylesheet" href="styles/jsdoc-default.css">
</head>

<body>

<div id="main">

    <h1 class="page-title">Source: maincontroller.js</h1>

    



    
    <section>
        <article>
            <pre class="prettyprint source linenums"><code>var BP = BP || {};

BP.MainController = class {
  constructor(
    $rootScope,
    $http,
    $location,
    $scope,
    $timeout,
    $sce,
    NavvisService,
    TranslationService
  ) {
    var self = this;
    window.main = this;

    self.$rootScope = $rootScope;
    self.$scope = $scope;
    self.NavvisService = NavvisService;
    self.TranslationService = TranslationService;
    self.$sce = $sce;
    self.$timeout = $timeout;
    self.$http = $http;
    self.$location = $location;
    self.showMenu = false;
    self.main_scene = '';
    self.currentYear = '';
    self.currentUser = {};
    self.activeLang = 'en';
    self.isLoggedIn = false;
    self.current_floor = '';
    self.floor_above = true;
    self.floor_below = false;
    self.selectedPoi = false;
    self.isMapVisible = false;

    self.$rootScope.$on(BP.Events.BP_READY, function(event, args) {
      self.init();
    });
  }

  init() {
    //query strings for url parameters : idlestartpos(bool)/idleturnspeed(integer)/idletimeout(integer)/wireframe(bool)
    this.urlPara = this.$location.search(); //checks what url paras we have
    this.isIdleModeJumpToLocation = this.urlPara.idlestartpos; //true or false string!!! not the actual value. compare as string
    this.idleTurn = this.urlPara.idleturnspeed;
    this.idleRotationSpeed = this.idleTurn / 1000; //recalculating the values to decrease the rotation speed
    this.idleTimerInSec = this.urlPara.idletimeout;
    this.idleTimerToMs = this.idleTimerInSec * 1000; //converting S in Ms
    this.mainView = IV.getMainView();

    //recreating the IV jump to starting location function
    this.startingLocationImage = IV.injector.get('ConfigService').configMap[
      'core.init.image'
    ];
    this.startingLocationLon = IV.injector.get('ConfigService').configMap[
      'core.init.lon'
    ];
    this.startingLocationLat = IV.injector.get('ConfigService').configMap[
      'core.init.lat'
    ];

    this.enableDumping = true; // enable/disable inertia
    this.dumpingFactor = 0.04; //friction value wich is the inertia decreasing  speed

    //3d hand mesh colors/wireframe url parameter and colors
    this.isWireFrameHand = this.urlPara.wireframe; //if wireframe is changed to true colors will change also;
    this.isWireFrameDefaultStartingHand = this.isWireFrameHand;
    if (!this.isWireFrameHand || this.isWireFrameHand === 'true') {
      //if wireframe url parameter is true will remain the same as if there wasnt any para
      this.isWireFrameDefaultStartingHand = true;
      this.handColorDefault = 0xcccccc; //color of the 3d hand mesh on default and event happening(grab,move)
      this.handColorEvent = 0x15a202;
    }
    //if url parameter ==='false' then change to textured hand with grey color without color changing
    if (this.isWireFrameHand === 'false') {
      this.isWireFrameDefaultStartingHand = false;
      this.handColorDefault = 0xe385; //color of the 3d hand mesh on default and event happening(grab,move)
      this.handColorEvent = 0xe385;
    }
    this.timeoutID; // the idle timer
    this.enableIdleScreen = false; //used to create the idle function
    this.isLeapPointingUp = true; //where is leap sensor pointing to so the axis get inverted if changed to false
    this.isIdleMode = false;
    this.isDoubleTap = false;
    this.isCameraY = false; //enable if want to look up and down while grabbing
    this.latestTap = -Infinity; //used to create double tap
    this.canvasX = 0;
    this.canvasY = 0;
    this.grabStartPos = []; //values are pushed into an array
    this.lastFrame = null;
    this.grabTriggerTresholdX = 0; //  px safety zone radius X-AXIS
    this.grabTriggerTresholdY = 0; // px safety zone radius Y- AXIS
    // this.camRotSpeed = 0.1;  //used for DOM element (NOT USED)
    this.diffGrabX = 0;
    this.diffGrabY = 0;
    this.velocity; //VELOCITY OF THE HAND DEFINED ON LEAP FRAME FUNCTION
    this.currentState = 0; //change to 1 if want to disable idle mode as default start
    //state machine used to create idle mode ( 0 will trigre idle mode , 1 will disable it)
    this.states = {
      IDLE: 0,
      HAND: 1
    };
    // console.log('Init MainCtrl');
    var self = this;

    //setting up the controller
    this.controller = new Leap.Controller({
      frameEventName: 'animationFrame',
      enableGestures: true //if want gesture enabled
    });

    this.controller.use('riggedHand', {
      materialOptions: {
        wireframe: this.isWireFrameDefaultStartingHand, //futuristic cand or normal textured hand
        color: new THREE.Color(this.handColorDefault) //changing color regarding event(grab or move)
      },
      geometryOptions: {},
      dotsMode: false,
      scale: 1,
      positionScale: 0.3, //speed of the hand in canvas
      offset: new THREE.Vector3(0, 0, 0)
    });

    //materials of the hand (check threejs materials doc)
    this.controller.on('riggedHand.meshAdded', function(handMesh, leapHand) {
      self.handMesh = handMesh;
      handMesh.material.opacity = 1;
      // handMesh.material.transparent = false;
      // handMesh.material.flatShading = true;
      // handMesh.material.castShadow = true;
      // handMesh.material.side = THREE.FrontSide;
      // handMesh.material.polygonOffset = true;
      // handMesh.material.depthTest = true;
      // handMesh.material.depthWrite = false;
      // handMesh.material.polygonOffsetFactor = -4;
      // handMesh.material.precision = 'highp';
      // handMesh.material.polygonOffsetUnits = 9;
      // handMesh.material.pointLight = false;
      // handMesh.material.ambientLight = false;
      // handMesh.material.emissive.setHex(0xF1C27D);
    });

    this.canvasElement = document.querySelectorAll('#mainScene canvas')[0]; //IV canvas selected

    //callbacks
    this.controller.on('frame', this.onLeapFrame.bind(this));
    this.controller.on('deviceAttached', this.onAttached.bind(this));
    this.controller.on('deviceRemoved', this.onRemoved.bind(this));
    this.controller.on('focus', this.onFocus.bind(this));
    console.log('CONTROLLER', this.controller);

    //enable the controller`s websocket when it`s plugged
    this.controller.connect();

    console.log(this.controller.streaming());

    // ---------------------------------------------------------------------------------------------------------------------------
    self.setLanguage('en');
    this.setYear();
    this.setMainScene();
    // this.setupLeap();
    // this.NavvisService.AboutService.fetchLicensesFile()
    //   .then((lic) => {
    //     this.licenses = lic;
    //   });

    this.isMapVisible = this.NavvisService.isMapVisible();
    this.NavvisService.isUserLoggedIn().then(e => {
      this.isLoggedIn = e;
      this.currentUser = this.NavvisService.getUserInfo();
      console.log('Logged In', e);
      console.log('Current User', this.currentUser);
    });

    this.mainScene = this.NavvisService.getMainScene();
    this.$scope.translate = self.TranslationService.c;
    this.$scope.languageName = {
      en: 'English',
      de: 'Deutsch'
    };

    this.setOtherLanguage = self.TranslationService.setOtherLanguage;
    var navvisLang = self.NavvisService.getLanguage();
    if (self.activeLang != navvisLang) self.activeLang = navvisLang;

    self.$scope.translate.setCurrentLanguage(self.NavvisService.getLanguage());
    self.otherLanguage = self.setOtherLanguage();

    self.NavvisService.IV.addEventListener(BP.Events.IV_POI_SELECTED, function(
      poi
    ) {
      self.selectedPoi = poi;
      console.log('Selected POI', poi);
    });
  }
  // -------------------------------------------------------------------------------------------------
  /**
   * checks whether hand is tracked and returns the number of hands
   * @constructor
   * @param {Object} frame frame data running continuous loop every 60 fps
   * @returns {Integer} whether hand is tracked (in JS every value > 1 is true, 0 is false)
   */
  countHands() {
    if (this.lastFrame) {
      return this.lastFrame.hands.length;
    }
  }

  isHandTracked() {
    return this.countHands();
  }
  // countHands(frame) {
  //   if (frame) {
  //     return frame.hands.length;
  //   }

  //   return 0;
  // }

  // blah(){
  //   var numOld = countHands(this.lastFrame)
  //   var numNew = countHands(this.frame)
  // }

  /**
   *  check if the hand is present and grabbing. If there is minimum 1 hand otherwise return false
   * @constructor
   * @param {Object} frame frame data running
   * @return {boolean} if hand is existent and grabing
   */
  isGrabbing(frame) {
    var hand = null;
    if (frame) {
      if (frame.hands.length > 0) {
        hand = frame.hands[0];
        // var position = hand.palmPosition;
        // var velocity = hand.palmVelocity;
        // console.log(velocity)
        // var direction = hand.direction;
        var grab = hand.grabStrength;
        // var pinch = hand.pinchStrength;
        // console.log(velocity)
      }
      // upper code in ternary
      // if (grab === 1) {
      //   return true;
      // } else if (grab === 0) {
      //   return false;
      // }
    }
    return grab === 1 ? true : grab === 0 ? false : null;
  }

  /**
   *Saves the current latitude and longitude of the hand when it`s grabbing. Color of the hand mesh is changed on grab
   *@constructor
   * @param {Object} [frame=null]
   *
   */
  onGrabStart(frame = null) {
    main.handMesh.material.color.setHex(this.handColorEvent);
    console.log('Screen Grabbed');

    this.grabStartPos = [this.canvasX, this.canvasY];
  }

  /**
   *On grab end change the mesh color back to default value and set the grabbing state to false
   *@constructor
   * @param {*} [frame=null] if there is no frame data it will be null
   */
  onGrabEnd(frame = null) {
    main.handMesh.material.color.setHex(this.handColorDefault);
    console.log('released');
    this.isGrabbed = false;
  }

  /**
   *Check if there is any hand hand present if not return false
   *@constructor
   * @param {Object} frame on frame loop
   * @returns {boolean}  if the loop is runing and hand is present in scene
   */
  isHandInScene(frame) {
    var hand = null;
    if (frame) {
      if (frame.hands.length > 0) {
        hand = frame.hands[0];
      }
      // if (hand) {
      //   return true;
      // } else {
      //   return false;
      // }
      // in ternary below the upper value
    }
    return hand ? true : false;
  }

  // Getting the data for pinching to b e used for different scenarios same as taking grab values---------------------------------------------------
  //   isPinching(frame){
  //     if(frame){
  //      if (frame.hands.length > 0) {
  //        var hand = frame.hands[0];
  //        // var position = hand.palmPosition;
  //        // var velocity = hand.palmVelocity;
  //        // console.log(velocity)
  //        // var direction = hand.direction;
  //        // var grab = hand.grabStrength;
  //        var pinch = hand.pinchStrength;
  //        // console.log(velocity)

  //      }

  //      if (pinch === 1) {

  //        return true;
  //      } else if (pinch === 0) {
  //        return false;
  //      }
  //   }
  //  };

  /**
   *If hand is traked will always return it`s position in canvas (Latitude,Longitude)
   *@constructor
   * @returns {Integer} Hand position in canvas X , Y values
   */
  getHandPosition() {
    if (this.isHandTracked()) {
      return {
        transform: 'translate(' + this.canvasX + 'px, ' + this.canvasY + 'px)'
      };
    }
  }

  /**
   *Recreating double tap event. Using the new date constructor. Taking the time when the first tap happens until the next one if double tap happens under 0.8s then gets the first image in direction and after moves to it
   *@constructor
   * @returns {Promise} Promise object represent the first image in direction and is consumed by moving to it when double tap happens, the numbers can be changed in order to move more or less in front.
   */
  checkDoubleTap() {
    if (this.isDoubleTap) {
      return;
    }
    var now = new Date().getTime();
    var timeSince = now - this.latestTap;

    if (timeSince &lt; 800 &amp;&amp; timeSince > 0) {
      // console.log('timeSince', timeSince, ', timeSince', timeSince);
      console.log('Moving to next location');
      main.handMesh.material.color.setHex(this.handColorEvent);
      this.isDoubleTap = true;

      IV.injector
        .get('ImageService')
        .getClosestImageInDir(
          this.NavvisService.IV.getMainView().currentImage,
          this.NavvisService.IV.getMainView().currViewingDir,
          1,
          5
        )
        .then(image => {
          IV.moveToLocation(image).then(() => {
            this.isDoubleTap = false;
            main.handMesh.material.color.setHex(this.handColorDefault);
          });
        });
    } else {
      console.log('Double tap again');
    }

    this.latestTap = new Date().getTime();
  }

  /**
   *State of Idle mode and it`s behavior(Jumping to IV starting location).If "idlestartpos" url parameter is true the idle mode jumps to location when idle mode triggers
   *@constructor
   */
  startIdleMode() {
    this.currentState = this.states.IDLE;
    console.log('Starting idle mode');
    if (this.isIdleModeJumpToLocation === 'true') {
      this.NavvisService.IV.moveToLocationId(this.startingLocationImage, {
        lon: this.startingLocationLon,
        lat: this.startingLocationLat
      });
    }
  }

  /**
   *If hand is back in scene, idle timeout is reset
   *@constructor
   */
  stopIdleMode() {
    window.clearTimeout(this.timeoutID);
  }

  /**
   *Leap motion predefined function for gesture. Choose from here what gestures you want to enable.Currently is used key tap which calls the function that is moving in viewing direction if this is triggered twice
   *@constructor
   * @param {Object} frame loop constantly checking what gestures are used
   */
  checkGestures(frame) {
    if (frame.valid &amp;&amp; frame.gestures.length > 0) {
      frame.gestures.forEach(gesture => {
        switch (gesture.type) {
          // case "circle":
          // console.log("Circle Gesture");
          // break;

          case 'keyTap':
            this.checkDoubleTap();
            // if(this.isDoubleTap){
            //   this.isDoubleTap = false;
            //    this.tappedTwice;
            // };

            break;

          // case "screenTap":
          // this.checkDoubleTap();
          // break;

          // case 'swipe':
          //   console.log('Swipe Gesture');
          //   break;
        }
      });
    }
  }

  /**
   *Main callback function, here happens everything
   *@constructor
   * @param {Object} frame running every 60 fps is main function which is doing all the callbacks
   */
  onLeapFrame(frame) {
    let canvasElement, normalizedPosition, interactionBox, palm;

    this.canvasElement = document.querySelectorAll('#mainScene canvas')[0]; //IV canvas selected to display the hand position
    this.checkGestures.call(this, frame);

    //if "idlestartpos" url parameter is set to -1 string idle mode is disabled
    if (this.idleTimerInSec === '-1') {
      this.currentState = 1;
    }

    this.isGrabbed = this.isGrabbing(frame); //returns boolean regarding the grab

    // this.isPinching(frame); //calling the pinching function

    // if there is a hand tracked, idle mode is stoped, defining velocity, stabilizing the hand position,
    //  defining also if the hand was grabbing last frame and if is grabbing in current frame.
    if (frame.pointables.length > 0) {
      this.currentState = this.states.HAND;
      this.stopIdleMode();
      this.velocity = frame.hands[0].palmVelocity;
      this.hand = frame.hands[0];
      this.handMesh = this.hand.data('riggedHand.mesh');
      // this.canvasElement.show(this.handMesh)
      // console.log(this.velocity)
      var stabilized = this.hand.stabilizedPalmPosition;
      var delta = Leap.vec3.create();
      Leap.vec3.subtract(delta, stabilized, this.hand.palmPosition); //stabilising hand position
      palm = frame.hands[0].palmPosition;
      interactionBox = frame.interactionBox; //used for 3d to 2d conversion
      normalizedPosition = interactionBox.normalizePoint(palm, true);
      // if this is grabbing in current frame and was not grabbing in the last frame(previous frame) then call the grab start function and save the lat/lon from where the grab happened
      if (this.isGrabbing(frame) &amp;&amp; !this.isGrabbing(this.lastFrame)) {
        this.onGrabStart(frame);
        this.lonOnGrabStart = this.lon;
        this.latOnGrabStart = this.lat;
      }
      //if this is not grabbing anymore in current frame and did grab in the previous frame this means the hand had stopped grabbing and is calling the grab end function.Then compare the lat/lon values and get the distance traveled by the hand
      if (!this.isGrabbing(frame) &amp;&amp; this.isGrabbing(this.lastFrame)) {
        this.onGrabEnd(frame);
        this.lonOnGrabEnd = this.lon;
        this.latOnGrabEnd = this.lat;
        this.distanceTraveledLon = this.lonOnGrabEnd - this.lonOnGrabStart;
        this.distanceTraveledLat = this.latOnGrabEnd - this.latOnGrabStart;
      }

      this.intElemClientWidth = window.innerWidth;
    }

    // cloning the lon/lat from IV.Updating the Orientation if the user is grabing based on the hand velocity--------------------------------------------------------------------------------------------
    let lon, lat;
    let mainView = this.NavvisService.IV.getMainView();
    this.lat = angular.copy(mainView.currViewingDir.lat);
    this.lon = angular.copy(mainView.currViewingDir.lon);
    //if grabbing happens then rotate the screen to opposite direction of hand movement multiplied by the speed of the hand(to change rotation speed change the numbers divided by velocity)
    if (this.isGrabbing(frame)) {
      // this.camRotSpeed = Math.abs(this.diffGrabX) / 300;
      this.velocityX = this.velocity[0] / 100;
      this.velocityY = this.velocity[1] / 100; // change velocity to 1 if you want to change axis  Y WITH Z
      if (this.diffGrabX) {
        this.lon += 0.009 * this.velocityX;
      }
      // if (this.diffGrabX &lt; -this.grabTriggerTresholdX) {

      //   this.lon +=  0.009 * velocityX;
      // };
      // Moving up and down based on Y axis-------------------------------------------------------------------------------
      if (this.isCameraY &amp;&amp; this.diffGrabY) {
        this.lat += 0.009 * this.velocityY;
      }
    }

    // INERTIA : If enabledumping=true then multiply the velocity with the distance traveled by the hand after grabbing until rel;released,  then subtract velocity speed to have a friction otherwise is rotating infinetly
    if (this.enableDumping &amp;&amp; !this.isGrabbing(frame)) {
      if (this.lonOnGrabEnd > this.lonOnGrabStart) {
        this.lon += (this.velocityX / 100) * this.distanceTraveledLon;
        this.velocityX *= 1 - this.dumpingFactor;
      }
      if (this.lonOnGrabEnd &lt; this.lonOnGrabStart) {
        this.lon -= (this.velocityX / 100) * this.distanceTraveledLon;
        this.velocityX *= 1 - this.dumpingFactor;
      }

      //Latitude get`s back to 0 easily(so the screen won`t be looking only up/down if it`s moved so by mistake)
      // if (this.lat > 0) {
      //   this.lat -= 0.01;
      // } else if (this.lat &lt; -0.2) {
      //   this.lat += 0.01;
      // }

      // latitude INERTIA . Uncomment if want to enable camera for up and down while grabbing -------------------------------
      // if(this.latOnGrabEnd > this.latOnGrabStart){
      //   this.lat += (this.velocityY / 100 ) * this.distanceTraveledLat;
      //   this.velocityY *= (1 - this.dumpingFactor);

      // };
      // if(this.latOnGrabEnd &lt; this.latOnGrabStart){
      //   this.lat -=  (this.velocityY / 100 ) * this.distanceTraveledLat;
      //   this.velocityY *= (1 - this.dumpingFactor);

      // };
      // this.lon += this.inertia ;
      // this.dLon = this.lon - this.prevLon;
      // this.lonVelocity = this.dLon / this.dT;
    }

    // checking idle mode state
    if (this.currentState == this.states.IDLE) {
      //As default idle mode is rotating to left if no url parameter is present
      if (!this.idleTurn) {
        this.idleRotationSpeed = 0.0006;
      }
      this.lon += this.idleRotationSpeed;
      // console.log(this.idleRotationSpeed)
    }

    //default timer for idle mode
    if (!this.idleTimerInSec) {
      //if no timeout url parameter is set the default is 30sec
      this.idleTimerToMs = 30000;
    }

    // trigger the timer for idle mode if hand is present again in scene the timer resets
    if (!this.isHandInScene(frame) &amp;&amp; this.isHandInScene(this.lastFrame)) {
      this.timeoutID = window.setTimeout(
        this.startIdleMode.bind(this),
        this.idleTimerToMs
      );
    }

    mainView.updateOrientation({ lon: this.lon, lat: this.lat });
    mainView.invalidateScene();

    // Fixed a bug where the user couldn`t grab and rotate the screen when grabbing was at 0/max lon width of the screen
    if (this.canvasX != 0) {
      this.diffGrabX = this.canvasX - this.grabStartPos[0];
    }
    if (this.canvasX == this.intElemClientWidth) {
      this.diffGrabX = this.canvasX - 1 - this.grabStartPos[0];
    }

    // else {
    //   this.diffGrabX = (this.canvasX + 1) - this.grabStartPos[0];
    // };
    this.diffGrabY = this.canvasY - this.grabStartPos[1];

    // Changing axis regarding sensor mounting
    this.NavvisService.safeApply(() => {
      this.lastFrame = frame;

      if (normalizedPosition) {
        if (this.isLeapPointingUp) {
          this.canvasX = this.canvasElement.width * normalizedPosition[0];
          this.canvasY =
            this.canvasElement.height * (1 - normalizedPosition[1]);
        } else {
          this.canvasX =
            this.canvasElement.width *
            (1 -
              normalizedPosition[0]); /* inverted axis for camera pointing downwards */
          this.canvasY = this.canvasElement.height * normalizedPosition[1];
        }
      }
    });
  }

  // ----------------------------------------- Leap Events -----------------------------------

  onAttached() {
    console.log('Device attached');
  }
  onRemoved() {
    console.log('Device removed');
  }
  onFocus() {
    console.log('Focused window');
  }

  // -----------------------------------------------------------------------------
  setLanguage(key) {
    this.NavvisService.setLanguage(key);
    this.activeLang = key;
  }

  isMobileView() {
    return this.$rootScope.breakpoint === 'viewport-mobile';
  }

  safeApply(fn) {
    var phase = this.$rootScope.$$phase;
    if (phase == '$apply' || phase == '$digest') {
      if (fn &amp;&amp; typeof fn === 'function') {
        fn();
      }
    } else {
      this.$scope.$apply(fn);
    }
  }

  updateFloors() {
    this.floor_below = this.NavvisService.hasFloorBelow();
    this.floor_above = this.NavvisService.hasFloorAbove();
  }

  switchLanguage() {
    window.IV.setLanguage(this.$scope.otherLanguage);
    this.activeLang = this.$scope.otherLanguage;
    this.NavvisService.setLanguage(this.activeLang);
    this.otherLanguage = this.setOtherLanguage();
  }

  setYear() {
    var today = new Date();
    var year = today.getFullYear();
    console.log('Year:', year);
    this.$scope.currentYear = year;
  }

  centerMap() {
    return this.NavvisService.centerMap();
  }

  toggleMainMenu() {
    this.showMenu = !this.showMenu;
  }

  swapScenes() {
    this.NavvisService.swapScenes();
    this.main_scene = this.NavvisService.getMainScene();
  }

  setMainScene() {
    this.main_scene = this.NavvisService.getMainScene();
  }

  goToFloorBelow() {
    event.preventDefault();
    this.NavvisService.goToFloorBelow();
    this.updateFloors();
  }

  goToFloorAbove() {
    event.preventDefault();
    this.NavvisService.goToFloorAbove();
    this.updateFloors();
  }
};
</code></pre>
        </article>
    </section>




</div>

<nav>
    <h2><a href="index.html">Home</a></h2><h3>Classes</h3><ul><li><a href="BP.MainController_checkDoubleTap.html">checkDoubleTap</a></li><li><a href="BP.MainController_checkGestures.html">checkGestures</a></li><li><a href="BP.MainController_countHands.html">countHands</a></li><li><a href="BP.MainController_getHandPosition.html">getHandPosition</a></li><li><a href="BP.MainController_isGrabbing.html">isGrabbing</a></li><li><a href="BP.MainController_isHandInScene.html">isHandInScene</a></li><li><a href="BP.MainController_onGrabEnd.html">onGrabEnd</a></li><li><a href="BP.MainController_onGrabStart.html">onGrabStart</a></li><li><a href="BP.MainController_onLeapFrame.html">onLeapFrame</a></li><li><a href="BP.MainController_startIdleMode.html">startIdleMode</a></li><li><a href="BP.MainController_stopIdleMode.html">stopIdleMode</a></li></ul>
</nav>

<br class="clear">

<footer>
    Documentation generated by <a href="https://github.com/jsdoc3/jsdoc">JSDoc 3.5.5</a> on Thu Mar 28 2019 11:17:46 GMT+0100 (W. Europe Standard Time)
</footer>

<script> prettyPrint(); </script>
<script src="scripts/linenumber.js"> </script>
</body>
</html>

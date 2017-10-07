import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import * as THREE from 'three';
import ExpoTHREE from 'expo-three';
global.THREE = THREE;

require('./OBJLoader');

import Expo, { Asset } from 'expo';

console.disableYellowBox = true;

const scaleLongestSideToSize = (mesh, size) => {
  const { x: width, y: height, z: depth } =
    new THREE.Box3().setFromObject(mesh).getSize();
  const longest = Math.max(width, Math.max(height, depth));
  const scale = size / longest;
  mesh.scale.set(scale, scale, scale);
}

export default class App extends React.Component {
  state = {
    loaded: false,
  }

  // happens once as an initializer
  componentWillMount() {
    this.preloadAssetsAsync();
  }

  // load large files from disk, and wait until they're all in
  // before the app renders its first time
  async preloadAssetsAsync() {
    await Promise.all([
      require('./assets/bear.obj'),
      require('./assets/bear.png'),
    ].map((module) => Expo.Asset.fromModule(module).downloadAsync()));

    // react paradigm: render() will be called when we call setState
    // to change the componeont's underlying state
    this.setState({ loaded: true });
  }

  render() {
    return this.state.loaded ? (
      <View style={{ flex: 1 }}>
        <Expo.GLView
          ref={(ref) => this._glView = ref}
          style={{ flex: 1 }}
          onContextCreate={this._onGLContextCreate}
        />
      </View>
    ) : <Expo.AppLoading />;
  }

  // Called when the OpenGL context has been initialized
  // The OpenGL context manages state for this particular
  // app's usage of openGl. Each app needs its own instance
  // so that the state of opengl inside one app can't affect
  // its state within another
  _onGLContextCreate = async (gl) => {

    // start AR session
    const arSession = await this._glView.startARSessionAsync();

    // set up three.js renderer
    const scene = new THREE.Scene();

    const camera = ExpoTHREE.createARCamera(
      arSession,
      gl.drawingBufferWidth,
      gl.drawingBufferHeight,
      0.01, // near plane (objects closer than this distance in the +z-direction won't be rendered)
      1000 // far plane (objects beyond this distance in the -z-direction won't be rendered)
    );

    const renderer = ExpoTHREE.createRenderer({ gl });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    scene.background = ExpoTHREE.createARBackgroundTexture(arSession, renderer);

    camera.position.z = 3;

    // make a green box!
    const geometry = new THREE.BoxGeometry(0.07, 0.07, 0.07);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });

    // model
    const modelAsset = Asset.fromModule(require('./assets/bear.obj'));
    await modelAsset.downloadAsync();
    const loader = new THREE.OBJLoader();
    const model = loader.parse(
      await Expo.FileSystem.readAsStringAsync(modelAsset.localUri))

    // lights
    const dirLight = new THREE.DirectionalLight(0xdddddd);
    dirLight.position.set(1, 1, 1);
    scene.add(dirLight);
    const ambLight = new THREE.AmbientLight(0x505050);
    scene.add(ambLight);

    // texture
    const textureAsset = Asset.fromModule(require('./assets/bear.png'));
    const ballTexture = new THREE.Texture();
    ballTexture.image = {
      data: textureAsset,
      width: textureAsset.width,
      height: textureAsset.height,
    };
    ballTexture.needsUpdate = true;
    ballTexture.isDataTexture = true; // send to gl.texImage2D() verbatim
    const ballMaterial =  new THREE.MeshPhongMaterial({map: ballTexture});

    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = ballMaterial;
      }
    });

    scene.add(model);

    model.position.y = -0.2;
    model.position.z = -0.5;

    model.rotation.y = Math.PI/2;

    scaleLongestSideToSize(model, 0.4);

    // main run loop!
    const animate = () => {

      // (1) update any model state
      // Do physics calcuations for this frame,
      // move objects, handle collisions between items, etc.

      //model.rotation.x += 0.02;
      //model.rotation.y += 0.05;

      // (2) draw the current frame based upon state
      renderer.render(scene, camera);
      gl.endFrameEXP();

      // re-do the main loop
      requestAnimationFrame(animate);
    }
    animate();
  }
}

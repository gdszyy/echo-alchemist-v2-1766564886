/**
 * Echo Alchemist 3D Rendering System
 * Camera management for the 3D scene.
 */

import * as THREE from 'three';

export function createCamera() {
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;
    return camera;
}

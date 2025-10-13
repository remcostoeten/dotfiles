import { Setup } from './core/Setup.js';
import { FishModule } from './modules/FishModule.js';

// Import and add other modules here
const modules = [
  new FishModule(),
  // Add more modules here
];

const setup = new Setup(modules);
setup.run().catch(error => {
  console.error('Setup failed:', error);
  process.exit(1);
});
// @ts-check
import { mount } from 'svelte';
import './styles/tokens.css';
import './styles/base.css';
import './lib/ui/buttons.css';
import './lib/ui/chips.css';
import './lib/ui/switch.css';
import App from './App.svelte';

mount(App, { target: /** @type {HTMLElement} */ (document.getElementById('app')) });

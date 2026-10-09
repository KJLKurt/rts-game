/** Isolated CI only: start the existing static host at the exact previous dist. */
import './tests/browser/serve-production.mjs';
const response=await fetch('http://127.0.0.1:4181/__qa/previous',{method:'POST'});
if(!response.ok)throw new Error('Unable to select the exact previous production build.');
console.log('Exact previous-live production selected for the two red-first identities.');

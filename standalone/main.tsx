import { createRoot } from 'react-dom/client';
import Page from '../app/page';
import '../app/globals.css';
import '../app/keeper.css';
import '../app/activity-tabs.css';
import '../app/combat.css';
import '../app/materials.css';
import '../app/identity.css';
import '../app/workspace-refresh.css';
import '../app/vitals.css';

createRoot(document.getElementById('root')!).render(<Page/>);

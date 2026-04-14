<script>
	import '../app.css';
	import { Tooltip } from 'bits-ui';

	let { children } = $props();
</script>

<Tooltip.Provider delayDuration={400}>
	{@render children()}
</Tooltip.Provider>

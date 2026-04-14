<script lang="ts">
	import type { SourceInfo } from './editor-bridge';
	import PipelineItem from './PipelineItem.svelte';
	import Panel from '$lib/ui/Panel.svelte';

	interface Props {
		source: SourceInfo;
		selectedId: string | null;
		onSelect: (id: string) => void;
	}

	let { source, selectedId, onSelect }: Props = $props();

	const SOURCE_ID = '__source__';
</script>

<Panel title="Source">
	<div data-source-list>
		<PipelineItem
			adjustment={{
				id: SOURCE_ID,
				plugin_id: source.entries[0]?.plugin_id ?? 'seer.source.standard',
				name: 'Source',
				enabled: true,
				params: {},
				zone: 'Full'
			}}
			index={0}
			isSelected={selectedId === SOURCE_ID}
			isSource={true}
			isDimmed={false}
			hasError={false}
			errorMessage={null}
			zoneIcons={null}
			onSelect={() => onSelect(SOURCE_ID)}
			onToggle={() => {}}
			onRemove={() => {}}
		/>
	</div>
</Panel>

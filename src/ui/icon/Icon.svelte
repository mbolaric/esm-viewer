<script lang="ts">
    import { getIconComponent, type IconName } from './icon-registry.js';

    interface IProps {
        className?: string | undefined;
        name: IconName;
        size?: 'default' | 'large' | 'small';
    }

    let { className = undefined, name, size = 'default' }: IProps = $props();
    const IconComponent = $derived(getIconComponent(name));
    const iconSize = $derived(
        size === 'large' ? 'var(--size-icon-large)' : size === 'small' ? 'var(--size-icon-small)' : 'var(--size-icon)',
    );
</script>

<IconComponent aria-hidden="true" class={className} focusable="false" size={iconSize} />

/** @odoo-module **/

import { registry } from "@web/core/registry";
import { formView } from "@web/views/form/form_view";
import { useThrottleForAnimation } from "@web/core/utils/timing";
import { useSubEnv, onMounted, onWillUnmount } from "@odoo/owl";

export class MassMailingFullWidthViewController extends formView.Controller {
    setup() {
        super.setup();
        useSubEnv({
            onIframeUpdated: () => this._updateIframe(),
            onToggleFullscreen: () => this._onToggleFullscreen(),
            mailingFilterTemplates: true,
        });
        const throttledOnResizeObserved = useThrottleForAnimation(() => {
            this._resizeMailingEditorIframe();
            this._repositionMailingEditorSidebar();
        });
        this._resizeObserver = new ResizeObserver(throttledOnResizeObserved);
        const throttledRepositionSidebar = useThrottleForAnimation(
            this._repositionMailingEditorSidebar.bind(this)
        );
        onMounted(() => {
            $('.o_content').on('scroll.repositionMailingEditorSidebar', throttledRepositionSidebar);
            $('.o_form_sheet_bg').on('scroll.repositionMailingEditorSidebar', throttledRepositionSidebar);
        });
        onWillUnmount(() => {
            $('.o_content').off('.repositionMailingEditorSidebar');
            this._resizeObserver.disconnect();
        });
    }
    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------
    /**
     * Resize the given iframe so its height fits its contents and initialize a
     * resize observer to resize on each size change in its contents.
     * This also ensures the contents of the sidebar remain visible no matter
     * how much we resize the iframe and scroll down.
     *
     * @private
     * @param {JQuery} ev.data.$iframe
     */
    _updateIframe() {
        const $iframe = $('iframe.wysiwyg_iframe:visible, iframe.o_readonly');
        if (!$iframe.length || !$iframe.contents().length) {
            return;
        }
        const hasIframeChanged = !this.$iframe || !this.$iframe.length || $iframe[0] !== this.$iframe[0];
        this.$iframe = $iframe;
        this._resizeMailingEditorIframe();

        const $iframeDoc = $iframe.contents();
        const iframeTarget = $iframeDoc.find('#iframe_target');
        if (hasIframeChanged) {
            if (iframeTarget[0]) {
                this._resizeObserver.disconnect();
                this._resizeObserver.observe(iframeTarget[0]);
            }
        }
        if (iframeTarget[0]) {
            const isFullscreen = this._isFullScreen();
            iframeTarget.css({
                display: isFullscreen ? '' : 'flex',
                'flex-direction': isFullscreen ? '' : 'column',
            });
        }
    }
    /**
     * Reposition the sidebar so it always occupies the full available visible
     * height, no matter the scroll position. This way, the sidebar is always
     * visible and as big as possible.
     *
     * @private
     */
    _repositionMailingEditorSidebar() {
        // TODO: This should be refactored. The style of the SnippetsMenu should
        // not be changed like this, instead, it should be changed via its
        // methods (or through props in OWL)
        const $sidebar = $('#oe_snippets');
        if (!this._isFullScreen()) {
            $sidebar.css({
                height: window.innerHeight - $('.o_content').offset().top,
            });
        } else {
            $sidebar.css({
                height: '',
            });
        }
    }
    /**
     * Switch "scrolling modes" on toggle fullscreen mode: in fullscreen mode,
     * the scroll happens within the iframe whereas in regular mode we pretend
     * there is no iframe and scroll in the top document. Also reposition the
     * sidebar since toggling the fullscreen mode visibly changes the
     * positioning of elements in the document.
     *
     * @private
     */
    _onToggleFullscreen() {
        const isFullscreen = this._isFullScreen();
        const $iframeDoc = this.$iframe.contents();
        const html = $iframeDoc.find('html').get(0);
        html.scrollTop = 0;
        html.classList.toggle('o_fullscreen', isFullscreen);
        this.$iframe[0].style.width = isFullscreen ? "" : "100%";
        const wysiwyg = $iframeDoc.find('.note-editable').data('wysiwyg');
        if (wysiwyg && wysiwyg.snippetsMenu) {
            // Restore the appropriate scrollable depending on the mode.
            this._$scrollable = this._$scrollable || wysiwyg.snippetsMenu.$scrollable;
            wysiwyg.snippetsMenu.$scrollable = isFullscreen ? $iframeDoc.find('.note-editable') : this._$scrollable;
        }
        this._repositionMailingEditorSidebar();
        this._resizeMailingEditorIframe();
    }
    /**
     * Return true if the mailing editor is in full screen mode, false
     * otherwise.
     *
     * @private
     * @returns {boolean}
     */
    _isFullScreen() {
        return window.top.document.body.classList.contains('o_field_widgetTextHtml_fullscreen');
    }
    /**
     * Resize the mailing editor's iframe container so its height fits its
     * contents. This needs to be called whenever the iframe's contents might
     * have changed, eg. when adding/removing content to/from it or when a
     * template is picked.
     *
     * @private
     */
    _resizeMailingEditorIframe() {
        const minHeight = $(window).height() - Math.abs(this.$iframe.offset().top);
        const $iframeDoc = this.$iframe.contents();
        const $themeSelectorNew = $iframeDoc.find('.o_mail_theme_selector_new');
        if ($themeSelectorNew.length) {
            this.$iframe.height(Math.max($themeSelectorNew[0].scrollHeight, minHeight));
        } else {
            const ref = $iframeDoc.find('#iframe_target')[0];
            if (ref) {
                this.$iframe.parent().addBack().css({
                    height: this._isFullScreen()
                        ? $(window).height()
                        : Math.max(ref.scrollHeight, minHeight),
                });
            }
        }
    }
}

export const massMailingFormView = {
    ...formView,
    Controller: MassMailingFullWidthViewController,
};

registry.category("views").add("mailing_mailing_view_form_full_width", massMailingFormView);

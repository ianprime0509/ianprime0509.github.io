const std = @import("std");
const zine = @import("zine");

pub fn build(b: *std.Build) !void {
    zine.website(b, .{
        .title = "Ian Johnson",
        .host_url = "https://ianjohnson.dev",
        .content_dir_path = "content",
        .layouts_dir_path = "layouts",
        .assets_dir_path = "assets",
        .static_assets = &.{
            // Used by GitHub Pages
            "CNAME",
            "fonts/Inter-Italic-VariableFont_opsz,wght.ttf",
            "fonts/Inter-VariableFont_opsz,wght.ttf",
        },
    });
}

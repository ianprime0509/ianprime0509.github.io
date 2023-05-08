---
title: Zero-cost bindings with Zig
date: 2023-05-07
---

Well, it's been two and a half years since my last blog post, but now seems like
as good a time as any to pick it back up 😄 The last time I posted, I was
investigating making a GUI using GTK and Go; now, I'm back to making GUIs using
GTK, but using [Zig](https://ziglang.org/) rather than Go. I've really been
enjoying using Zig for many reasons, including its ability to effortlessly work
with C code while providing lots of useful abstractions and tools of its own.
This post will dive into some of the ways Zig can improve the expressiveness of
C code without adding any runtime overhead (hence the title, "zero-cost
bindings").

# Getting started: a simple GTK example

To start with, let's set up a simple GTK example project. I'll be using the
latest Zig master version at the time of writing (`0.11.0-dev.3000+d71a43ec2`).
The GTK documentation has
[a simple "hello world" example](https://docs.gtk.org/gtk4/getting_started.html#hello-world-in-c)
which, despite being small and unimpressive, has a lot of functionality for us
to explore using in Zig.

For the first step in this journey, we won't even write any GTK code in Zig. One
of Zig's selling points is
[the ability to maintain existing C and C++ code using Zig](https://kristoff.it/blog/maintain-it-with-zig/),
leveraging the powerful Zig build system, so let's start with copying the
example C code verbatim into a new project and adding a simple `build.zig` to
it.

In `hello.c`:

```c
#include <gtk/gtk.h>

static void
print_hello (GtkWidget *widget,
             gpointer   data)
{
  g_print ("Hello World\n");
}

static void
activate (GtkApplication *app,
          gpointer        user_data)
{
  GtkWidget *window;
  GtkWidget *button;
  GtkWidget *box;

  window = gtk_application_window_new (app);
  gtk_window_set_title (GTK_WINDOW (window), "Window");
  gtk_window_set_default_size (GTK_WINDOW (window), 200, 200);

  box = gtk_box_new (GTK_ORIENTATION_VERTICAL, 0);
  gtk_widget_set_halign (box, GTK_ALIGN_CENTER);
  gtk_widget_set_valign (box, GTK_ALIGN_CENTER);

  gtk_window_set_child (GTK_WINDOW (window), box);

  button = gtk_button_new_with_label ("Hello World");

  g_signal_connect (button, "clicked", G_CALLBACK (print_hello), NULL);
  g_signal_connect_swapped (button, "clicked", G_CALLBACK (gtk_window_destroy), window);

  gtk_box_append (GTK_BOX (box), button);

  gtk_widget_show (window);
}

int
main (int    argc,
      char **argv)
{
  GtkApplication *app;
  int status;

  app = gtk_application_new ("org.gtk.example", G_APPLICATION_DEFAULT_FLAGS);
  g_signal_connect (app, "activate", G_CALLBACK (activate), NULL);
  status = g_application_run (G_APPLICATION (app), argc, argv);
  g_object_unref (app);

  return status;
}
```

In `build.zig`:

```zig
const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const exe = b.addExecutable(.{
        .name = "hello-world",
        .target = target,
        .optimize = optimize,
    });
    b.installArtifact(exe);
    exe.linkLibC();
    exe.linkSystemLibrary("gtk4");
    exe.addCSourceFile("hello.c", &.{});

    const run_cmd = b.addRunArtifact(exe);
    run_cmd.step.dependOn(b.getInstallStep());
    if (b.args) |args| {
        run_cmd.addArgs(args);
    }

    const run_step = b.step("run", "Run the app");
    run_step.dependOn(&run_cmd.step);
}
```

With just these two files, we can run `zig build run` in the project directory
and see the simple application start up. Amazing!

Much of `build.zig` is exactly what `zig init-exe` produces, but there are a few
changes to make it work with the `hello.c` file instead of a Zig source file.
First of all, the `.root_source_file` has been removed from the `addExecutable`
options, because our project doesn't have any Zig source files in it at the
moment. Instead, we're using `exe.addCSourceFile("hello.c", &.{})` to add the
`hello.c` source file to our executable. The first argument to `addCSourceFile`
is the path to the file, and the second is a slice of any compiler options we
might want to add (real projects would probably include options such as `-Wall`
to get more warnings from the compiler).

The other change is the addition of `exe.linkLibC()` and
`exe.linkSystemLibrary("gtk4")`. The first of these is needed to link the C
standard library to the executable, which is a requirement for GTK, and the
second is needed to link GTK itself. Zig uses the `pkg-config` tool to determine
all the flags it needs to find the GTK header files and libraries to use in our
application.

This approach scales far beyond this simple example. Others have used the Zig
build system to build real-world C projects, such as
[ffmpeg](https://github.com/andrewrk/ffmpeg/). However, this post is focused on
using the Zig language to provide abstractions over C APIs, so let's press on
and start writing some Zig code...

# Writing it in Zig: a first attempt

Here's `hello.zig`, a fairly direct conversion of the original `hello.c` code:

```zig
const c = @cImport(@cInclude("gtk/gtk.h"));
const std = @import("std");

fn printHello(_: *c.GtkWidget, _: ?*anyopaque) callconv(.C) void {
    c.g_print("Hello World\n");
}

fn activate(app: *c.GtkApplication, _: ?*anyopaque) callconv(.C) void {
    const window = c.gtk_application_window_new(app);
    c.gtk_window_set_title(@ptrCast(*c.GtkWindow, window), "Window");
    c.gtk_window_set_default_size(@ptrCast(*c.GtkWindow, window), 200, 200);

    const box = c.gtk_box_new(c.GTK_ORIENTATION_VERTICAL, 0);
    c.gtk_widget_set_halign(box, c.GTK_ALIGN_CENTER);
    c.gtk_widget_set_valign(box, c.GTK_ALIGN_CENTER);

    c.gtk_window_set_child(@ptrCast(*c.GtkWindow, window), box);

    const button = c.gtk_button_new_with_label("Hello World");

    _ = c.g_signal_connect_data(button, "clicked", @ptrCast(c.GCallback, &printHello), null, null, 0);
    _ = c.g_signal_connect_data(button, "clicked", @ptrCast(c.GCallback, &c.gtk_window_destroy), window, null, c.G_CONNECT_SWAPPED);

    c.gtk_box_append(@ptrCast(*c.GtkBox, box), button);

    c.gtk_widget_show(window);
}

pub fn main() void {
    const app = c.gtk_application_new("org.gtk.example", c.G_APPLICATION_DEFAULT_FLAGS);
    _ = c.g_signal_connect_data(app, "activate", @ptrCast(c.GCallback, &activate), null, null, 0);
    const status = c.g_application_run(@ptrCast(*c.GApplication, app), @intCast(c_int, std.os.argv.len), @ptrCast([*c][*c]u8, std.os.argv.ptr));
    c.g_object_unref(app);

    std.os.exit(@intCast(u8, status));
}
```

This is not particularly pretty Zig code, but it will get better! There are a
few notable differences from the original C code which should be explained in
more detail.

First, due to a
[known limitation in `zig translate-c`](https://github.com/ziglang/zig/issues/5596),
the use of the `g_signal_connect` and `g_signal_connect_swapped` macros have
been replaced with direct calls to `g_signal_connect_data` (which is what the
macros do internally).

Second, all the `GTK_WINDOW`, etc. type cast macros have been replaced with
explicit `@ptrCast`s, because `zig translate-c` is unable to translate the
macros to valid Zig code.

Finally, the translated example uses a conventional Zig `main` function taking
no parameters and returning `void`, so it uses `std.os.argv` and `std.os.exit`
to access the program arguments and exit with the correct status, respectively.

The `addExecutable` part of our `build.zig` file now looks like this, since
we're now using a Zig source file instead of a C source file (the rest of
`build.zig` is unchanged):

```zig
const exe = b.addExecutable(.{
    .name = "hello-world",
    .root_source_file = .{ .path = "hello.zig" },
    .target = target,
    .optimize = optimize,
});
b.installArtifact(exe);
exe.linkLibC();
exe.linkSystemLibrary("gtk4");
```

The application still builds and runs successfully with `zig build run`. The
`build.zig` file will remain unchanged from this point on, but `hello.zig` can
be greatly improved.

# Improving the bindings: namespaces and transparent wrappers

Unlike C, Zig allows structs to contain declarations such as constants and
functions. This means that a C function such as `gtk_window_set_title` could be
expressed in Zig as a member function `setTitle` on a type named `gtk.Window`,
which makes the namespace pattern much clearer while avoiding a lot of
unnecessary duplication. Let's wrap the C types used in this example in structs
and namespace the associated declarations:

```zig
pub const gobject = struct {
    pub const Callback = *const fn () callconv(.C) void;
    pub const Closure = opaque {};
    pub const ClosureNotify = *const fn (?*anyopaque, *Closure) callconv(.C) void;
    pub const ConnectFlags = c_uint;

    extern fn g_signal_connect_data(instance: *Object, detailed_signal: [*:0]const u8, c_handler: Callback, data: ?*anyopaque, destroy_data: ?ClosureNotify, connect_flags: ConnectFlags) c_ulong;
    pub const signalConnectData = g_signal_connect_data;

    pub const Object = extern struct {
        inner: c.GObject,

        extern fn g_object_unref(object: ?*Object) void;
        pub const unref = g_object_unref;
    };
};

pub const gio = struct {
    pub const ApplicationFlags = c_uint;

    pub const Application = extern struct {
        inner: c.GApplication,

        extern fn g_application_run(application: *Application, argc: c_int, argv: [*][*:0]u8) c_int;
        pub const run = g_application_run;
    };
};

pub const gtk = struct {
    pub const Align = c_uint;
    pub const Orientation = c_uint;

    pub const Application = extern struct {
        inner: c.GtkApplication,

        extern fn gtk_application_new(id: [*:0]const u8, flags: gio.ApplicationFlags) *Application;
        pub const new = gtk_application_new;
    };

    pub const ApplicationWindow = extern struct {
        inner: c.GtkApplicationWindow,

        extern fn gtk_application_window_new(application: *Application) *ApplicationWindow;
        pub const new = gtk_application_window_new;
    };

    pub const Box = extern struct {
        inner: c.GtkBox,

        extern fn gtk_box_append(box: *Box, widget: *Widget) void;
        pub const append = gtk_box_append;

        extern fn gtk_box_new(orientation: Orientation, spacing: c_int) *Box;
        pub const new = gtk_box_new;
    };

    pub const Button = extern struct {
        inner: c.GtkButton,

        extern fn gtk_button_new_with_label(label: [*:0]const u8) *Button;
        pub const newWithLabel = gtk_button_new_with_label;
    };

    pub const Widget = extern struct {
        inner: c.GtkWidget,

        extern fn gtk_widget_set_halign(widget: *Widget, halign: Align) void;
        pub const setHalign = gtk_widget_set_halign;

        extern fn gtk_widget_set_valign(widget: *Widget, valign: Align) void;
        pub const setValign = gtk_widget_set_valign;

        extern fn gtk_widget_show(widget: *Widget) void;
        pub const show = gtk_widget_show;
    };

    pub const Window = extern struct {
        inner: c.GtkWindow,

        extern fn gtk_window_set_child(window: *Window, child: *Widget) void;
        pub const setChild = gtk_window_set_child;

        extern fn gtk_window_set_default_size(window: *Window, width: c_int, height: c_int) void;
        pub const setDefaultSize = gtk_window_set_default_size;

        extern fn gtk_window_set_title(window: *Window, title: [*:0]const u8) void;
        pub const setTitle = gtk_window_set_title;
    };
};
```

There's a lot going on here, so let's break it down bit by bit.

First, we're using structs with no fields to create namespaces for `gobject`,
`gio`, and `gtk` to keep their respective declarations separate. Namespaces in
Zig are just structs with no fields: in fact, every Zig file is implicitly a
struct, so our `hello.zig` file has actually been a namespace struct just like
these ones from the very beginning! If our goal was actually to create bindings
for GTK and all associated libraries, then these structs would probably be best
as separate files themselves, but for this simplified example it's fine to keep
them in the same file.

Second, we've represented each type used in the bindings as an `extern struct`
with a single field of the underlying C type. Using an extern struct rather than
a regular struct ensures consistent memory layout: we want our `gobject.Object`
type to have the same memory layout as the underlying `GObject` type so it acts
as a transparent wrapper.

Third, we've added aliases for enum and flag types such as
`gio.ApplicationFlags` using the underlying C types. Right now, these aren't
very interesting, but we will improve on these later to further refine the API.

Finally, we've replicated the `extern fn` declarations for all the functions
used in our code within their respective namespaces and added aliases to expose
them with more idiomatic names. For example, `gtk_button_new_with_label` is
aliased as `newWithLabel`, since it will be accessed from the container
`gtk.Button`. The declarations have been tweaked from the C originals to
reference our transparent wrapper types, as in `*Button` rather than
`*c.GtkButton`. The return types of the various `new` functions have also been
corrected to the actual type being returned, rather than just `*Widget` as the
GTK headers often do (this will come in handy later).

So what does `hello.zig` look like when it's updated to use these enhanced
bindings?

```zig
fn printHello(_: *gtk.Widget, _: ?*anyopaque) callconv(.C) void {
    std.debug.print("Hello World\n", .{});
}

fn activate(app: *gtk.Application, _: ?*anyopaque) callconv(.C) void {
    const window = gtk.ApplicationWindow.new(app);
    @ptrCast(*gtk.Window, window).setTitle("Window");
    @ptrCast(*gtk.Window, window).setDefaultSize(200, 200);

    const box = gtk.Box.new(c.GTK_ORIENTATION_VERTICAL, 0);
    @ptrCast(*gtk.Widget, box).setHalign(c.GTK_ALIGN_CENTER);
    @ptrCast(*gtk.Widget, box).setValign(c.GTK_ALIGN_CENTER);

    @ptrCast(*gtk.Window, window).setChild(@ptrCast(*gtk.Widget, box));

    const button = gtk.Button.newWithLabel("Hello World");

    _ = gobject.signalConnectData(@ptrCast(*gobject.Object, button), "clicked", @ptrCast(gobject.Callback, &printHello), null, null, 0);
    _ = gobject.signalConnectData(@ptrCast(*gobject.Object, button), "clicked", @ptrCast(gobject.Callback, &c.gtk_window_destroy), window, null, c.G_CONNECT_SWAPPED);

    box.append(@ptrCast(*gtk.Widget, button));

    @ptrCast(*gtk.Widget, window).show();
}

pub fn main() void {
    const app = gtk.Application.new("org.gtk.example", c.G_APPLICATION_DEFAULT_FLAGS);
    _ = gobject.signalConnectData(@ptrCast(*gobject.Object, app), "activate", @ptrCast(gobject.Callback, &activate), null, null, 0);
    const status = @ptrCast(*gio.Application, app).run(@intCast(c_int, std.os.argv.len), @ptrCast([*][*:0]u8, std.os.argv.ptr));
    @ptrCast(*gobject.Object, app).unref();

    std.os.exit(@intCast(u8, status));
}
```

Still not amazing, but getting a little better! Some parts of it are starting to
look more like idiomatic Zig code, but there are still quite a few `@ptrCast`s.
The call to `g_print` in `printHello` has also been replaced with
`std.debug.print`, but that isn't related to the binding changes.

# Subclass methods using mixins

How do we get rid of the `@ptrCast`s? The reason for many of them is that GTK
uses the [GObject type system](https://docs.gtk.org/gobject/concepts.html),
which is an object-oriented programming framework for C, making heavy use of
inheritance. Take our `gtk.Widget.show` function, for example: this function is
defined on `Widget`, and logically applies to subclasses such as
`ApplicationWindow`. But neither Zig nor C support the concept of inheritance
directly, so both languages require casting the `ApplicationWindow` pointer to a
`Widget` pointer before we can use a function that accepts a `Widget`.

We've seen the power of namespacing at work already, so what if we just make a
copy of this function in our `ApplicationWindow` namespace which uses an
`*ApplicationWindow` parameter instead of `*Widget`?

```zig
// In the ApplicationWindow struct:
extern fn gtk_widget_show(widget: *ApplicationWindow) void;
pub const show = gtk_widget_show;
```

This works, and allows us to remove the `@ptrCast` from `*ApplicationWindow` to
`*Widget` when calling `show`. However, doing this manually for every subclass
of `Widget` is tedious and error-prone, especially if we want to support _all_
the GTK widget types rather than just the few used in this example. There is a
better way, using Zig's powerful comptime features:

```zig
pub const gobject = struct {
    pub const Callback = *const fn () callconv(.C) void;
    pub const Closure = opaque {};
    pub const ClosureNotify = *const fn (?*anyopaque, *Closure) callconv(.C) void;
    pub const ConnectFlags = c_uint;

    extern fn g_signal_connect_data(instance: *Object, detailed_signal: [*:0]const u8, c_handler: Callback, data: ?*anyopaque, destroy_data: ?ClosureNotify, connect_flags: ConnectFlags) c_ulong;
    pub const signalConnectData = g_signal_connect_data;

    pub const Object = extern struct {
        inner: c.GObject,

        pub usingnamespace Methods(Object);

        pub fn Methods(comptime Self: type) type {
            return struct {
                extern fn g_object_unref(object: ?*Self) void;
                pub const unref = g_object_unref;
            };
        }
    };
};

pub const gio = struct {
    pub const ApplicationFlags = c_uint;

    pub const Application = extern struct {
        inner: c.GApplication,

        pub usingnamespace Methods(Application);

        pub fn Methods(comptime Self: type) type {
            return struct {
                extern fn g_application_run(application: *Self, argc: c_int, argv: [*][*:0]u8) c_int;
                pub const run = g_application_run;

                pub usingnamespace gobject.Object.Methods(Self);
            };
        }
    };
};

pub const gtk = struct {
    pub const Align = c_uint;
    pub const Orientation = c_uint;

    pub const Application = extern struct {
        inner: c.GtkApplication,

        extern fn gtk_application_new(id: [*:0]const u8, flags: gio.ApplicationFlags) *Application;
        pub const new = gtk_application_new;

        pub usingnamespace Methods(Application);

        pub fn Methods(comptime Self: type) type {
            return struct {
                pub usingnamespace gio.Application.Methods(Self);
            };
        }
    };

    pub const ApplicationWindow = extern struct {
        inner: c.GtkApplicationWindow,

        extern fn gtk_application_window_new(application: *Application) *ApplicationWindow;
        pub const new = gtk_application_window_new;

        pub usingnamespace Methods(ApplicationWindow);

        pub fn Methods(comptime Self: type) type {
            return struct {
                pub usingnamespace Window.Methods(Self);
            };
        }
    };

    pub const Box = extern struct {
        inner: c.GtkBox,

        extern fn gtk_box_new(orientation: Orientation, spacing: c_int) *Box;
        pub const new = gtk_box_new;

        pub usingnamespace Methods(Box);

        pub fn Methods(comptime Self: type) type {
            return struct {
                extern fn gtk_box_append(box: *Self, widget: *Widget) void;
                pub const append = gtk_box_append;

                pub usingnamespace Widget.Methods(Self);
            };
        }
    };

    pub const Button = extern struct {
        inner: c.GtkButton,

        extern fn gtk_button_new_with_label(label: [*:0]const u8) *Button;
        pub const newWithLabel = gtk_button_new_with_label;

        pub usingnamespace Methods(Button);

        pub fn Methods(comptime Self: type) type {
            return struct {
                pub usingnamespace Widget.Methods(Self);
            };
        }
    };

    pub const Widget = extern struct {
        inner: c.GtkWidget,

        pub usingnamespace Methods(Widget);

        pub fn Methods(comptime Self: type) type {
            return struct {
                extern fn gtk_widget_set_halign(widget: *Self, halign: Align) void;
                pub const setHalign = gtk_widget_set_halign;

                extern fn gtk_widget_set_valign(widget: *Self, valign: Align) void;
                pub const setValign = gtk_widget_set_valign;

                extern fn gtk_widget_show(widget: *Self) void;
                pub const show = gtk_widget_show;

                pub usingnamespace gobject.Object.Methods(Self);
            };
        }
    };

    pub const Window = extern struct {
        inner: c.GtkWindow,

        pub usingnamespace Methods(Window);

        pub fn Methods(comptime Self: type) type {
            return struct {
                extern fn gtk_window_set_child(window: *Self, child: *Widget) void;
                pub const setChild = gtk_window_set_child;

                extern fn gtk_window_set_default_size(window: *Self, width: c_int, height: c_int) void;
                pub const setDefaultSize = gtk_window_set_default_size;

                extern fn gtk_window_set_title(window: *Self, title: [*:0]const u8) void;
                pub const setTitle = gtk_window_set_title;

                pub usingnamespace Widget.Methods(Self);
            };
        }
    };
};
```

Each class now has a `Methods` function which takes a type, `Self`, and returns
another type containing the method declarations for the class (the "methods"
being the functions which take an object pointer as their first argument, called
as `obj.method()` in Zig). The object pointer type is replaced with `*Self`
rather than hard-coding the name of the receiver type. Then, when we want to
include all the methods for a type `A` in another type `B`, we use
`pub usingnamespace A.Methods(B)`: calling `A.Methods(B)` returns a struct with
all of `A`'s methods, but with `B` as the receiver type, and
`pub usingnamespace` adds all its declarations to `B` as if we had written them
directly.

We can even using the `pub usingnamespace` trick within the struct returned by
`Methods`, which allows us to chain up and transitively include methods from all
superclasses as well. We're using the power of Zig's comptime to achieve the
result we wanted before (including parent class method declarations on child
classes) without the tedious manual work of copying and editing each method from
every parent class.

So what does our main `hello.zig` logic look like now that we've removed the
need for `@ptrCast`s on method receivers?

```zig
fn printHello(_: *gtk.Widget, _: ?*anyopaque) callconv(.C) void {
    std.debug.print("Hello World\n", .{});
}

fn activate(app: *gtk.Application, _: ?*anyopaque) callconv(.C) void {
    const window = gtk.ApplicationWindow.new(app);
    window.setTitle("Window");
    window.setDefaultSize(200, 200);

    const box = gtk.Box.new(c.GTK_ORIENTATION_VERTICAL, 0);
    box.setHalign(c.GTK_ALIGN_CENTER);
    box.setValign(c.GTK_ALIGN_CENTER);

    window.setChild(@ptrCast(*gtk.Widget, box));

    const button = gtk.Button.newWithLabel("Hello World");

    _ = gobject.signalConnectData(@ptrCast(*gobject.Object, button), "clicked", @ptrCast(gobject.Callback, &printHello), null, null, 0);
    _ = gobject.signalConnectData(@ptrCast(*gobject.Object, button), "clicked", @ptrCast(gobject.Callback, &c.gtk_window_destroy), window, null, c.G_CONNECT_SWAPPED);

    box.append(@ptrCast(*gtk.Widget, button));

    window.show();
}

pub fn main() void {
    const app = gtk.Application.new("org.gtk.example", c.G_APPLICATION_DEFAULT_FLAGS);
    _ = gobject.signalConnectData(@ptrCast(*gobject.Object, app), "activate", @ptrCast(gobject.Callback, &activate), null, null, 0);
    const status = app.run(@intCast(c_int, std.os.argv.len), @ptrCast([*][*:0]u8, std.os.argv.ptr));
    app.unref();

    std.os.exit(@intCast(u8, status));
}
```

This is a lot better! That's a lot of `@ptrCast`s gone.

This also demonstrates the reason why we needed to fix the return types of the
`new` methods: if `gtk.ApplicationWindow.new` still returned a `*Widget`, for
example, we still wouldn't be able to call `window.setTitle("Window")` or other
window-specific methods without a `@ptrCast`.

# Better flags and enums

We can do even better with our bindings by refining the flag and enum types
which are currently lazily aliased to `c_uint` in our namespaces. To avoid
duplicating all the bindings again (as they're getting larger with each
improvement), I'll just demonstrate the improved binding technique for one flag
type and one enum type.

First is an enum type. Instead of using a plain `c_uint`, we can use an enum
backed by a `c_uint`, which makes the allowed values explicit while maintaining
the underlying representation (meaning it is still valid for us to use the enum
type in our `extern fn` declarations):

```zig
pub const Align = enum(c_uint) {
    fill = 0,
    start = 1,
    end = 2,
    center = 3,
    baseline = 4,
};
```

This also means that when we have a function which accepts an `Align` parameter,
we can pass a value such as `.center` (thanks to Zig allowing the enum type name
to be omitted when it can be implied), rather than the more cumbersome
`c.GTK_ALIGN_CENTER`.

A little more surprising is how Zig allows us to improve on the representation
of a flag type:

```zig
pub const ApplicationFlags = packed struct(c_uint) {
    is_service: bool = false,
    is_launcher: bool = false,
    handles_open: bool = false,
    handles_command_line: bool = false,
    send_environment: bool = false,
    non_unique: bool = false,
    can_override_app_id: bool = false,
    allow_replacement: bool = false,
    replace: bool = false,
    _padding: u23 = 0,
};
```

Within a `packed struct`, there is no padding between fields, and fields take up
exactly their bit size (so, in particular, a `bool` is only one bit rather than
taking up a whole byte). Since we're using an explict tag type of `c_uint`, we
know that this type is still directly compatible with `c_uint`, so our
`extern fn` declarations are still valid.

Now, instead of writing a bitwise expression such as
`c.G_APPLICATION_IS_SERVICE | c.G_APPLICATION_HANDLES_OPEN`, we can just write
`.{ .is_service = true, .handles_open = true }`, which more closely mirrors the
common Zig pattern of passing an "options" struct to a function.

Here's what the main `hello.zig` code looks like now:

```zig
fn printHello(_: *gtk.Widget, _: ?*anyopaque) callconv(.C) void {
    std.debug.print("Hello World\n", .{});
}

fn activate(app: *gtk.Application, _: ?*anyopaque) callconv(.C) void {
    const window = gtk.ApplicationWindow.new(app);
    window.setTitle("Window");
    window.setDefaultSize(200, 200);

    const box = gtk.Box.new(.vertical, 0);
    box.setHalign(.center);
    box.setValign(.center);

    window.setChild(@ptrCast(*gtk.Widget, box));

    const button = gtk.Button.newWithLabel("Hello World");

    _ = gobject.signalConnectData(@ptrCast(*gobject.Object, button), "clicked", @ptrCast(gobject.Callback, &printHello), null, null, .{});
    _ = gobject.signalConnectData(@ptrCast(*gobject.Object, button), "clicked", @ptrCast(gobject.Callback, &c.gtk_window_destroy), window, null, .{ .swapped = true });

    box.append(@ptrCast(*gtk.Widget, button));

    window.show();
}

pub fn main() void {
    const app = gtk.Application.new("org.gtk.example", .{});
    _ = gobject.signalConnectData(@ptrCast(*gobject.Object, app), "activate", @ptrCast(gobject.Callback, &activate), null, null, .{});
    const status = app.run(@intCast(c_int, std.os.argv.len), @ptrCast([*][*:0]u8, std.os.argv.ptr));
    app.unref();

    std.os.exit(@intCast(u8, status));
}
```

The enum and flag parameters definitely look a lot cleaner in this version.

# What's next?

One really neat aspect of the bindings written through the examples above is
that they are zero-cost: the bindings expose the underlying GTK functions
directly, without forcing the user to go through wrapper functions (which may
impose a runtime penalty or may not expose the full power of the wrapped API).
There are still improvements to be made: in particular, signal connection is
still tedious and not type-safe (there is no guarantee that the signal handlers
actually accept the correct parameter types). However, I hope this exploration
has demonstrated the power that Zig brings to working with C APIs and motivated
you (the reader) to experiment with some of these techniques in your own
projects 😃

Since GTK is such a huge library, maintaining these bindings by hand (even with
the comptime metaprogramming tools Zig provides) would be a massive task. A much
more sustainable approach would be to generate similar bindings from
[GObject introspection](https://gitlab.gnome.org/GNOME/gobject-introspection)
data, which is what many other language bindings (such as
[gtk-rs](https://gtk-rs.org/)) do: GObject introspection exposes rich type
information (including properties such as nullability which are not directly
present in C) for bindings to leverage in exposing more idiomatic APIs such as
the one explored above. This is exactly what my WIP
[zig-gobject](https://github.com/ianprime0509/zig-gobject) project does. At the
time of writing, it is not yet ready to use (it depends on some unmerged Zig PRs
related to the package manager), but I hope to share it with the community soon
🚀

# Addendum: the final `hello.zig` file

Here's the final `hello.zig` file, with all of the enhancements described in the
sections above:

```zig
const c = @cImport(@cInclude("gtk/gtk.h"));
const std = @import("std");

fn printHello(_: *gtk.Widget, _: ?*anyopaque) callconv(.C) void {
    std.debug.print("Hello World\n", .{});
}

fn activate(app: *gtk.Application, _: ?*anyopaque) callconv(.C) void {
    const window = gtk.ApplicationWindow.new(app);
    window.setTitle("Window");
    window.setDefaultSize(200, 200);

    const box = gtk.Box.new(.vertical, 0);
    box.setHalign(.center);
    box.setValign(.center);

    window.setChild(@ptrCast(*gtk.Widget, box));

    const button = gtk.Button.newWithLabel("Hello World");

    _ = gobject.signalConnectData(@ptrCast(*gobject.Object, button), "clicked", @ptrCast(gobject.Callback, &printHello), null, null, .{});
    _ = gobject.signalConnectData(@ptrCast(*gobject.Object, button), "clicked", @ptrCast(gobject.Callback, &c.gtk_window_destroy), window, null, .{ .swapped = true });

    box.append(@ptrCast(*gtk.Widget, button));

    window.show();
}

pub fn main() void {
    const app = gtk.Application.new("org.gtk.example", .{});
    _ = gobject.signalConnectData(@ptrCast(*gobject.Object, app), "activate", @ptrCast(gobject.Callback, &activate), null, null, .{});
    const status = app.run(@intCast(c_int, std.os.argv.len), @ptrCast([*][*:0]u8, std.os.argv.ptr));
    app.unref();

    std.os.exit(@intCast(u8, status));
}

pub const gobject = struct {
    pub const Callback = *const fn () callconv(.C) void;
    pub const Closure = opaque {};
    pub const ClosureNotify = *const fn (?*anyopaque, *Closure) callconv(.C) void;
    pub const ConnectFlags = packed struct(c_uint) {
        after: bool = false,
        swapped: bool = false,
        _padding: u30 = 0,
    };

    extern fn g_signal_connect_data(instance: *Object, detailed_signal: [*:0]const u8, c_handler: Callback, data: ?*anyopaque, destroy_data: ?ClosureNotify, connect_flags: ConnectFlags) c_ulong;
    pub const signalConnectData = g_signal_connect_data;

    pub const Object = extern struct {
        inner: c.GObject,

        pub usingnamespace Methods(Object);

        pub fn Methods(comptime Self: type) type {
            return struct {
                extern fn g_object_unref(object: ?*Self) void;
                pub const unref = g_object_unref;
            };
        }
    };
};

pub const gio = struct {
    pub const ApplicationFlags = packed struct(c_uint) {
        is_service: bool = false,
        is_launcher: bool = false,
        handles_open: bool = false,
        handles_command_line: bool = false,
        send_environment: bool = false,
        non_unique: bool = false,
        can_override_app_id: bool = false,
        allow_replacement: bool = false,
        replace: bool = false,
        _padding: u23 = 0,
    };

    pub const Application = extern struct {
        inner: c.GApplication,

        pub usingnamespace Methods(Application);

        pub fn Methods(comptime Self: type) type {
            return struct {
                extern fn g_application_run(application: *Self, argc: c_int, argv: [*][*:0]u8) c_int;
                pub const run = g_application_run;

                pub usingnamespace gobject.Object.Methods(Self);
            };
        }
    };
};

pub const gtk = struct {
    pub const Align = enum(c_uint) {
        fill = 0,
        start = 1,
        end = 2,
        center = 3,
        baseline = 4,
    };
    pub const Orientation = enum(c_uint) {
        horizontal = 0,
        vertical = 1,
    };

    pub const Application = extern struct {
        inner: c.GtkApplication,

        extern fn gtk_application_new(id: [*:0]const u8, flags: gio.ApplicationFlags) *Application;
        pub const new = gtk_application_new;

        pub usingnamespace Methods(Application);

        pub fn Methods(comptime Self: type) type {
            return struct {
                pub usingnamespace gio.Application.Methods(Self);
            };
        }
    };

    pub const ApplicationWindow = extern struct {
        inner: c.GtkApplicationWindow,

        extern fn gtk_application_window_new(application: *Application) *ApplicationWindow;
        pub const new = gtk_application_window_new;

        pub usingnamespace Methods(ApplicationWindow);

        pub fn Methods(comptime Self: type) type {
            return struct {
                pub usingnamespace Window.Methods(Self);
            };
        }
    };

    pub const Box = extern struct {
        inner: c.GtkBox,

        extern fn gtk_box_new(orientation: Orientation, spacing: c_int) *Box;
        pub const new = gtk_box_new;

        pub usingnamespace Methods(Box);

        pub fn Methods(comptime Self: type) type {
            return struct {
                extern fn gtk_box_append(box: *Self, widget: *Widget) void;
                pub const append = gtk_box_append;

                pub usingnamespace Widget.Methods(Self);
            };
        }
    };

    pub const Button = extern struct {
        inner: c.GtkButton,

        extern fn gtk_button_new_with_label(label: [*:0]const u8) *Button;
        pub const newWithLabel = gtk_button_new_with_label;

        pub usingnamespace Methods(Button);

        pub fn Methods(comptime Self: type) type {
            return struct {
                pub usingnamespace Widget.Methods(Self);
            };
        }
    };

    pub const Widget = extern struct {
        inner: c.GtkWidget,

        pub usingnamespace Methods(Widget);

        pub fn Methods(comptime Self: type) type {
            return struct {
                extern fn gtk_widget_set_halign(widget: *Self, halign: Align) void;
                pub const setHalign = gtk_widget_set_halign;

                extern fn gtk_widget_set_valign(widget: *Self, valign: Align) void;
                pub const setValign = gtk_widget_set_valign;

                extern fn gtk_widget_show(widget: *Self) void;
                pub const show = gtk_widget_show;

                pub usingnamespace gobject.Object.Methods(Self);
            };
        }
    };

    pub const Window = extern struct {
        inner: c.GtkWindow,

        pub usingnamespace Methods(Window);

        pub fn Methods(comptime Self: type) type {
            return struct {
                extern fn gtk_window_set_child(window: *Self, child: *Widget) void;
                pub const setChild = gtk_window_set_child;

                extern fn gtk_window_set_default_size(window: *Self, width: c_int, height: c_int) void;
                pub const setDefaultSize = gtk_window_set_default_size;

                extern fn gtk_window_set_title(window: *Self, title: [*:0]const u8) void;
                pub const setTitle = gtk_window_set_title;

                pub usingnamespace Widget.Methods(Self);
            };
        }
    };
};
```

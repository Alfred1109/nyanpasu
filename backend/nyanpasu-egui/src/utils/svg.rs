use csscolorparser::Color as CssColor;
use eframe::egui::ColorImage;
use resvg::tiny_skia::Pixmap;
use usvg::{Error, Options, Transform, Tree};

/// Parse SVG with currentColor replacement
/// Currently uses string replacement as workaround for https://github.com/RazrFalcon/resvg/issues/768
/// Will be updated when upstream provides native support
pub fn parse_svg_with_current_color_replace<T: Into<CssColor>>(
    svg: &str,
    color: T,
) -> Result<Tree, Error> {
    let color: CssColor = color.into();
    let color_hex = color.to_css_hex();
    
    // More robust color replacement supporting various formats
    let svg = svg
        .replace(r#""currentColor""#, &format!(r#""{}""#, color_hex))
        .replace(r#"'currentColor'"#, &format!(r#"'{}'"#, color_hex))
        .replace("currentColor", &color_hex);
    
    Tree::from_str(svg.as_str(), &Options::default())
}

pub fn render_svg(tree: &Tree, width: u32, height: u32) -> Result<Pixmap, Error> {
    let mut pixmap = Pixmap::new(width, height).unwrap();
    let original_width = tree.size().width();
    let original_height = tree.size().height();
    let scale_x = width as f32 / original_width;
    let scale_y = height as f32 / original_height;
    let transform = Transform::from_scale(scale_x, scale_y);
    resvg::render(tree, transform, &mut pixmap.as_mut());
    Ok(pixmap)
}

pub fn render_svg_with_current_color_replace<T: Into<CssColor>>(
    svg: &str,
    color: T,
    width: u32,
    height: u32,
) -> Result<Pixmap, Error> {
    let tree = parse_svg_with_current_color_replace(svg, color)?;
    render_svg(&tree, width, height)
}

/// Safe wrapper for SVG rendering that handles errors gracefully
#[allow(dead_code)] // Keep for future use
pub fn render_svg_safe<T: Into<CssColor>>(
    svg: &str,
    color: T,
    width: u32,
    height: u32,
) -> Option<Pixmap> {
    match render_svg_with_current_color_replace(svg, color, width, height) {
        Ok(pixmap) => Some(pixmap),
        Err(e) => {
            eprintln!("Failed to render SVG: {}", e);
            None
        }
    }
}

pub struct SvgWrapper<'a>(pub &'a Pixmap);

impl<'a> From<&'a Pixmap> for SvgWrapper<'a> {
    fn from(pixmap: &'a Pixmap) -> Self {
        SvgWrapper(pixmap)
    }
}

#[allow(clippy::wrong_self_convention)]
pub trait SvgExt {
    fn into_wrapper(&self) -> SvgWrapper<'_>;
}

impl SvgExt for Pixmap {
    fn into_wrapper(&self) -> SvgWrapper<'_> {
        SvgWrapper(self)
    }
}

impl SvgWrapper<'_> {
    pub fn into_egui_image(self) -> eframe::egui::ColorImage {
        let (width, height) = (self.0.width(), self.0.height());
        let pixels = self.0.pixels();
        let mut image_data = Vec::with_capacity(width as usize * height as usize * 4);
        for pixel in pixels {
            image_data.push(pixel.red());
            image_data.push(pixel.green());
            image_data.push(pixel.blue());
            image_data.push(pixel.alpha());
        }

        ColorImage::from_rgba_unmultiplied([width as usize, height as usize], &image_data)
    }
}

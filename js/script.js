$(document).ready(function() {

    // Sidebar navigation
    var $navSelector = $('ul.nav-sidebar li');

    $navSelector.click(function(e) {
        e.preventDefault();
        $navSelector.removeClass('active');
        $(this).addClass('active');
        container = $(this).children('a').attr('href');
        $('html, body').animate({
            scrollTop: $(container).offset().top
        }, 1000);
    });

});
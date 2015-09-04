module.exports = function(grunt) {
    'use strict';

    require('load-grunt-tasks')(grunt);

    grunt.registerTask('jshint', [
        'jshint'
    ]);

    grunt.registerTask('js', [
        'jsbeautifier:default'
    ]);

    grunt.registerTask('jsdry', [
        'jsbeautifier:verify'
    ]);

    grunt.initConfig({
        jsbeautifier: {
            options: {
                config: '.jsbeautifyrc'
            },

            default: {
                src: ['*.js', '*/*.js'],
            },

            verify: {
                src: ['*.js', '*/*.js'],
                options: {
                    mode: 'VERIFY_ONLY'
                }
            }
        },
        jshint: {
            src: {
                options: {
                    jshintrc: '.jshintrc'
                },
                src: ['*.js', '*/*.js']
            }
        }

    });

};
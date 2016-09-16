
	// Fire 'end' when a mouse or pen leaves the document.
	function documentLeave ( event, data ) {
		if ( event.type === "mouseout" && event.target.nodeName === "HTML" && event.relatedTarget === null ){
			eventEnd ( event, data );
		}
	}

	// Handle movement on document for handle and range drag.
	function eventMove ( event, data ) {

		// Fix #498
		// Check value of .buttons in 'start' to work around a bug in IE10 mobile (data.buttonsProperty).
		// https://connect.microsoft.com/IE/feedback/details/927005/mobile-ie10-windows-phone-buttons-property-of-pointermove-event-always-zero
		// IE9 has .buttons and .which zero on mousemove.
		// Firefox breaks the spec MDN defines.
		if ( navigator.appVersion.indexOf("MSIE 9") === -1 && event.buttons === 0 && data.buttonsProperty !== 0 ) {
			return eventEnd(event, data);
		}

		var proposal = ((event.calcPoint - data.startCalcPoint) * 100) / data.baseSize;
		var movingUpward = proposal > 0;
		var proposals = data.locations.map(function(a){ return a + proposal; });
		var handleNumbers = data.handleNumber.slice();
		var state = true;

		// Check to see which handle is 'leading' // TODO explain
		if ( movingUpward ) {
			handleNumbers.reverse();
		}

		handleNumbers.forEach(function(handleNumber) {
			if ( state ) {
				state = setHandle(handleNumber, proposals[handleNumber], APPLY_MARGIN, APPLY_LIMIT, LOOK_FORWARD);
			}
		});
	}

	// Unbind move events on document, call callbacks.
	function eventEnd ( event, data ) {

		// The handle is no longer active, so remove the class.
		var active = scope_Base.querySelector( '.' + options.cssClasses.active ),
			handleNumber = data.handles[0] === scope_Handles[0] ? 0 : 1; // TODO

		if ( active !== null ) {
			removeClass(active, options.cssClasses.active);
		}

		// Remove cursor styles and text-selection events bound to the body.
		if ( event.cursor ) {
			document.body.style.cursor = '';
			document.body.removeEventListener('selectstart', document.body.noUiListener);
		}

		// Unbind the move and end events, which are added on 'start'.
		document.documentElement.noUiListeners.forEach(function( c ) {
			document.documentElement.removeEventListener(c[0], c[1]);
		});

		// Remove dragging class.
		removeClass(scope_Target, options.cssClasses.drag);

		// Fire the change and set events.
		fireEvent('set', handleNumber);
		fireEvent('change', handleNumber);

		// If this is a standard handle movement, fire the end event.
		if ( data.handleNumber !== undefined ) { // TODO
			fireEvent('end', data.handleNumber);
		}
	}

	// Bind move events on document.
	function eventStart ( event, data ) {

		// Mark the handle as 'active' so it can be styled.
		if ( data.handles.length === 1 ) {

			// Support 'disabled' handles
			if ( data.handles[0].hasAttribute('disabled') ) {
				return false;
			}

			addClass(data.handles[0].children[0], options.cssClasses.active);
		}

		// Fix #551, where a handle gets selected instead of dragged.
		event.preventDefault();

		// A drag should never propagate up to the 'tap' event.
		event.stopPropagation();

		// Attach the move and end events.
		var moveEvent = attachEvent(actions.move, document.documentElement, eventMove, {
			startCalcPoint: event.calcPoint,
			baseSize: baseSize(),
			pageOffset: event.pageOffset,
			handles: data.handles,
			handleNumber: asArray(data.handleNumber),
			buttonsProperty: event.buttons,
			locations: scope_Locations.slice()
		});

		var endEvent = attachEvent(actions.end, document.documentElement, eventEnd, {
			handles: data.handles,
			handleNumber: data.handleNumber
		});

		var outEvent = attachEvent("mouseout", document.documentElement, documentLeave, {
			handles: data.handles,
			handleNumber: data.handleNumber
		});

		document.documentElement.noUiListeners = moveEvent.concat(endEvent, outEvent);

		// Text selection isn't an issue on touch devices,
		// so adding cursor styles can be skipped.
		if ( event.cursor ) {

			// Prevent the 'I' cursor and extend the range-drag cursor.
			document.body.style.cursor = getComputedStyle(event.target).cursor;

			// Mark the target with a dragging state.
			if ( scope_Handles.length > 1 ) {
				addClass(scope_Target, options.cssClasses.drag);
			}

			var f = function(){
				return false;
			};

			document.body.noUiListener = f;

			// Prevent text selection when dragging the handles.
			document.body.addEventListener('selectstart', f, false);
		}

		if ( data.handleNumber !== undefined ) {
			fireEvent('start', data.handleNumber);
		}
	}

	// Move closest handle to tapped location.
	function eventTap ( event ) {

		var calcPoint = event.calcPoint;
		var handleNumber = false;
		var minDistance = Number.MAX_VALUE;

		// The tap event shouldn't propagate up and cause 'edge' to run.
		event.stopPropagation();

		// Iterate all handles.
		scope_Handles.forEach(function(handle, index){

			// Disabled handles are ignored
			if ( handle.hasAttribute('disabled') ) {
				return;
			}

			var current = offset(handle)[options.style];
			var candidateMinDistance = Math.abs(current - calcPoint);

			// If the candidate is better, then update the minimum distance as well as the handle number.
			if ( candidateMinDistance < minDistance ) {
				minDistance = candidateMinDistance;
				handleNumber = index;
			}

			// If they are the same, the relative positions of handle and location decide whether there is an update.
			// This is needed for totally overlapping handles.
			else if ( candidateMinDistance == minDistance ) {

				// If this handle is before the calcPoint, then this handle should be selected.
				if ( current < calcPoint ) {
					handleNumber = index;
				}
			}

			// Else, that is the candidate is worse, then the candidates will be getting even worse from there on.
			else {
				return;
			}
		});

		// Tackle the case that all handles are 'disabled'.
		if ( handleNumber === false ) {
			return false;
		}

		calcPoint -= offset(scope_Base)[ options.style ];

		// Calculate the new position.
		var to = (calcPoint * 100) / baseSize();

		// Flag the slider as it is now in a transitional state.
		// Transition takes a configurable amount of ms (default 300). Re-enable the slider after that.
		if ( !options.events.snap ) {
			addClassFor(scope_Target, options.cssClasses.tap, options.animationDuration);
		}

		console.log(handleNumber);

		// Find the closest handle and calculate the tapped point.
		// The set handle to the new position.
		setHandle(handleNumber, to, APPLY_MARGIN, APPLY_MARGIN, LOOK_FORWARD);

		fireEvent('slide', handleNumber, true);
		fireEvent('set', handleNumber, true);
		fireEvent('change', handleNumber, true);

		if ( options.events.snap ) {
			eventStart(event, {
				handles: [scope_Handles[handleNumber]],
				handleNumber: [handleNumber]
			});
		}
	}

	// Fires a 'hover' event for a hovered mouse/pen position.
	function eventHover ( event ) {

		var location = event.calcPoint - offset(scope_Base)[ options.style ];
		var to = scope_Spectrum.getStep(( location * 100 ) / baseSize());
		var value = scope_Spectrum.fromStepping( to );

		Object.keys(scope_Events).forEach(function( targetEvent ) {
			if ( 'hover' === targetEvent.split('.')[0] ) {
				scope_Events[targetEvent].forEach(function( callback ) {
					callback.call( scope_Self, value );
				});
			}
		});
	}

	// Attach events to several slider parts.
	function bindSliderEvents ( behaviour ) {

		// Attach the standard drag event to the handles.
		if ( !behaviour.fixed ) {

			scope_Handles.forEach(function( handle, index ){

				// These events are only bound to the visual handle
				// element, not the 'real' origin element.
				attachEvent ( actions.start, handle.children[0], eventStart, {
					handles: [ handle ],
					handleNumber: index
				});
			});
		}

		// Attach the tap event to the slider base.
		if ( behaviour.tap ) {

			attachEvent ( actions.start, scope_Base, eventTap, {
				handles: scope_Handles
			});
		}

		// Fire hover events
		if ( behaviour.hover ) {
			attachEvent ( actions.move, scope_Base, eventHover, { hover: true } );
		}

		// Make the range draggable.
		if ( behaviour.drag ){

			scope_Connects.forEach(function( connect, index ){

				if ( connect === false || index === 0 || index === scope_Connects.length - 1 ) {
					return;
				}

				var handleBefore = scope_Handles[index - 1];
				var handleAfter = scope_Handles[index];
				var eventHolders = [connect];

				addClass(connect, options.cssClasses.draggable);

				// When the range is fixed, the entire range can
				// be dragged by the handles. The handle in the first
				// origin will propagate the start event upward,
				// but it needs to be bound manually on the other.
				if ( behaviour.fixed ) {
					eventHolders.push(handleBefore.children[0]);
					eventHolders.push(handleAfter.children[0]);
				}

				eventHolders.forEach(function( eventHolder ) {
					attachEvent ( actions.start, eventHolder, eventStart, {
						handles: [handleBefore, handleAfter],
						handleNumber: [index - 1, index]
					});
				});
			});
		}
	}
